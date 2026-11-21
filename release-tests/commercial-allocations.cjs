const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const backend = path.join(process.cwd(), "streamline-backend");
const deps = name => require(require.resolve(name, { paths: [backend] }));
const ts = deps("typescript");
const { Prisma } = deps("@prisma/client");
const decimal = value => new Prisma.Decimal(value);

function load(file, mocks) {
  const source = fs.readFileSync(path.join(backend, "src", file), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } });
  const exports = {};
  vm.runInNewContext(outputText, { exports, require: id => mocks[id] ?? deps(id), Date, console, Intl });
  return exports;
}

const calendarDate = day => new Date(day + "T00:00:00Z");
const dateParts = (day, time) => new Date(day.toISOString().slice(0, 10) + "T" + time + ":00Z");
const pricing = load("lib/commercialAllocation.ts", {
  "./commercialContracts": { calendarDate, contractShiftTiming: (day, time) => ({ estimatedStartTime: dateParts(day, time) }) },
});

const rate = {
  fare8Hours: decimal(310), fare12Hours: decimal(445), includedMiles8: decimal(100), includedMiles12: decimal(100),
  extraMileRate: decimal(1.15), overtimePerQuarter: decimal(10), overtimePerHour: decimal(40),
  saturdayStartPercent: null, sundayStartPercent: null, bankHolidayStartPercent: null,
};
const start = { startDate: "2026-10-31", startTime: "18:00", hours: 8, vehicleType: "SWB Van" };
const finish = { finishDate: "2026-11-01", finishTime: "02:15", odoStart: 500000, odoFinish: 500200 };
const quote = pricing.allocationCharges(start, finish, rate, false);
assert.equal(pricing.allocationWeekEnd(calendarDate("2026-10-26")), "2026-11-01");
assert.equal(pricing.allocationWeekEnd(calendarDate("2026-11-01")), "2026-11-01");
assert.equal(pricing.allocationWeekEnd(calendarDate("2026-11-02")), "2026-11-08");
assert.equal(quote.charges[1].quantity.toNumber(), 100);
assert.equal(quote.charges[1].unitPrice.mul(quote.charges[1].quantity).toNumber(), 115);
assert.equal(quote.charges[2].quantity.toNumber(), 1);
assert.equal(quote.charges[2].unitPrice.toNumber(), 10);
assert.equal(quote.surcharge[1].toNumber(), 20);
assert.equal(pricing.allocationCharges(start, finish, rate, true).surcharge[1].toNumber(), 50);
assert.equal(pricing.allocationCharges({ ...start, startDate: "2026-11-01", startTime: "00:00" },
  { ...finish, finishTime: "08:45" }, rate, false).charges[2].quantity.toNumber(), 3);
assert.throws(() => pricing.allocationCharges(start, { ...finish, odoFinish: 499999 }, rate, false), /odometer/);
const surcharge = pricing.allocationSurcharge([
  { netAmount: decimal(300), vatRate: decimal(20), vatAmount: decimal(60) },
  { netAmount: decimal(100), vatRate: decimal(0), vatAmount: decimal(0) },
], "Saturday start", decimal(20));
assert.equal(surcharge.reduce((sum, line) => sum.add(line.grossAmount), decimal(0)).toNumber(), 92);

const night = (start, end, percent = 20) => pricing.nightPremium(new Date(start), new Date(end), decimal(400), 12, decimal(percent));
const example = night("2026-11-02T20:00:00Z", "2026-11-03T08:00:00Z");
assert.equal(example.hours.toNumber(), 8);
assert.equal(example.amount.toFixed(2), "53.33");
assert.equal(example.amount.add(400).toFixed(2), "453.33");
assert.equal(night("2026-11-02T06:00:00Z", "2026-11-02T22:00:00Z").amount.toNumber(), 0);
assert.equal(night("2026-11-02T21:45:00Z", "2026-11-02T22:15:00Z").hours.toNumber(), 0.25);
assert.equal(night("2026-11-02T05:45:00Z", "2026-11-02T06:15:00Z").hours.toNumber(), 0.25);
assert.equal(night("2026-11-02T23:00:00Z", "2026-11-03T01:00:00Z").hours.toNumber(), 2);
assert.equal(night("2026-11-02T20:00:00Z", "2026-11-03T08:00:00Z", 0).amount.toNumber(), 0);
assert.equal(night("2026-11-02T20:00:00Z", "2026-11-03T08:00:00Z", 30).amount.toFixed(2), "80.00");
assert.equal(night("2026-07-02T19:00:00Z", "2026-07-03T07:00:00Z").hours.toNumber(), 8);
assert.equal(night("2026-03-28T22:00:00Z", "2026-03-29T05:00:00Z").hours.toNumber(), 7);
assert.equal(night("2026-10-24T21:00:00Z", "2026-10-25T06:00:00Z").hours.toNumber(), 9);
assert.equal(night("2026-11-02T20:00:00Z", "2026-11-04T08:00:00Z").hours.toNumber(), 16);
const withNight = pricing.allocationCharges(
  { ...start, startDate: "2026-11-02", startTime: "20:00", hours: 12 },
  { ...finish, finishDate: "2026-11-03", finishTime: "08:00" },
  { ...rate, fare12Hours: decimal(400), nightHoursPercent: decimal(20) }, false);
assert.equal(withNight.night.amount.toFixed(2), "53.33");
assert.equal(quote.night.amount.toNumber(), 0);
console.log("Night premium example, daytime, exact boundaries, partial hours, summer time and both UK clock changes passed.");

const routes = new Map();
const period = "2026-11-01";
const invoices = ["a", "b"].map((id, i) => ({
  id, userId: "customer", invoiceNumber: String(i + 1), bookingId: "booking-" + id,
  status: "DRAFT", invoiceType: "SINGLE", commercialPeriod: period, commercialGroupId: null,
  subtotal: decimal(100), vatAmount: decimal(20), total: decimal(120), adjustments: [],
}));
const profile = { accountsEmail: "accounts@example.invalid", paymentTermsDays: 30 };
const user = { companyName: "Test Courier", billingProfile: profile };
const emails = [];
const payments = [];
const previewBooking = {
  id: "night-shift", userId: "customer", reference: "SL#NIGHT", commercialAllocation: {
    driverName: "", routeReference: "NIGHT-1", registration: "", vehicleType: "SWB Van", hours: 12,
    startDate: "2026-11-02", startTime: "20:00",
  },
};
const members = id => invoices.filter(row => row.commercialGroupId === id);
const one = id => invoices.find(row => row.id === id);
const prisma = {
  $transaction: work => work(prisma),
  $queryRaw: async () => [],
  companySettings: { findFirstOrThrow: async () => ({ id: "settings" }) },
  billingProfile: { findUnique: async () => profile },
  booking: { findFirstOrThrow: async () => previewBooking },
  commercialTariffAssignment: { findUniqueOrThrow: async () => ({ tariffId: "premium" }) },
  commercialTariffRate: { findUniqueOrThrow: async () => ({ ...rate, fare12Hours: decimal(400), nightHoursPercent: decimal(20) }) },
  invoice: {
    findFirst: async ({ where }) => invoices.find(row =>
      row.userId === where.userId && row.commercialPeriod === where.commercialPeriod && row.invoiceType === where.invoiceType && row.status === where.status),
    findFirstOrThrow: async ({ where }) => {
      const row = one(where.id);
      assert.equal(row.userId, where.userId);
      return { ...row, user, commercialMembers: members(row.id) };
    },
    findMany: async ({ where }) => invoices.filter(row => row.userId === where.userId && row.status === where.status &&
      row.invoiceType === where.invoiceType && row.commercialPeriod === where.commercialPeriod && row.commercialGroupId === where.commercialGroupId),
    create: async ({ data }) => { const row = { ...data, id: "group", status: "DRAFT", adjustments: [] }; invoices.push(row); return row; },
    update: async ({ where, data }) => Object.assign(one(where.id), data),
    updateMany: async ({ where, data }) => {
      const selected = invoices.filter(row => typeof where.id === "object" ? where.id.in.includes(row.id) :
        row.id === where.id && (!where.commercialEmailStage || row.commercialEmailStage === where.commercialEmailStage));
      selected.forEach(row => Object.assign(row, data));
      return { count: selected.length };
    },
  },
  invoiceAuditEvent: { create: async () => {} },
  payment: { create: async ({ data }) => { payments.push(data); } },
};
load("routes/adminCommercialAllocations.ts", {
  express: { Router: () => ({
    use() {}, get() {}, post: (route, handler) => routes.set(route, handler),
  }) },
  "../lib/commercialAllocation": { ...pricing, allocationBankHoliday: async () => false },
  "../lib/commercialContracts": { calendarDate },
  "../lib/centralAdmin": {},
  "../lib/driverPortal": {},
  "../lib/fleetOperations": {},
  "../lib/invoiceNumber": { reserveInvoiceNumber: async () => "03" },
  "../lib/invoicePdf": { renderCommercialAllocationInvoicePdf: async invoice => Buffer.from(invoice.status) },
  "../lib/prisma": { prisma },
  "./bookings": {},
  "./invoices": { invoiceInclude: () => ({}), sendInvoiceEmail: async email => { emails.push(email); } },
});
const call = (route, params, body) => routes.get(route)({ params: { customerId: "customer", ...params }, body }, {
  status() { return this; }, json(data) { return data; },
});
const act = (id, action, data) => call("/:customerId/invoices/:id/:action", { id, action }, data);

async function run() {
  const adjustedLines = [
    { netAmount: decimal(400), vatRate: decimal(20), vatAmount: decimal(80), sourceType: "COMMERCIAL_ALLOCATION" },
    { netAmount: decimal("53.33"), vatRate: decimal(20), vatAmount: decimal("10.67"), sourceType: pricing.nightSource },
    { netAmount: decimal(100), vatRate: decimal(20), vatAmount: decimal(20), sourceType: "ADJUSTMENT" },
    { netAmount: decimal(80), vatRate: decimal(20), vatAmount: decimal(16), sourceType: pricing.surchargeSource,
      sourceId: "20", description: "Saturday start (20%)", bookingId: "night-shift", bookingReference: "SL#NIGHT" },
  ];
  const adjustedTotals = await pricing.refreshAllocationInvoiceTotals({ invoiceLine: {
    findMany: async () => adjustedLines, deleteMany: async () => {}, createMany: async () => {},
  } }, "invoice");
  assert.equal(adjustedTotals.total.toFixed(2), "784.00");
  assert.equal(adjustedTotals.subtotal.toFixed(2), "653.33");
  prisma.companySettings.findFirstOrThrow = async () => ({ id: "settings", vatRate: decimal(20) });
  const preview = await call("/:customerId/shifts/:id/preview", { id: "night-shift" }, {
    finishDate: "2026-11-03", finishTime: "08:00", odoStart: 100, odoFinish: 200, waitingId: "", waitingHours: 1,
    loadingId: "", additionalId: "", additionalQuantity: 1, discountId: "",
  });
  const nightLine = preview.lines.find(line => line.sourceType === pricing.nightSource);
  assert.equal(nightLine.netAmount.toFixed(2), "53.33");
  assert.match(nightLine.description, /8 hours at 20%/);
  assert.equal(preview.total.toFixed(2), "544.00");
  const group = await call("/:customerId/consolidate", {}, { period });
  assert.equal(group.id, "group");
  assert.equal(emails.length, 0);
  assert.deepEqual(members("group").map(row => row.status), ["DRAFT", "DRAFT"]);
  await act("group", "finalise-send");
  assert.deepEqual(invoices.map(row => row.status), ["ISSUED", "ISSUED", "ISSUED"]);
  assert.equal(emails.length, 1);
  assert.equal(emails[0].to, profile.accountsEmail);
  assert.equal(emails[0].invoiceNumber, "03");
  await assert.rejects(act("a", "record-payment"), /consolidated invoice/);
  await act("group", "unfinalise");
  assert.deepEqual(invoices.map(row => row.status), ["DRAFT", "DRAFT", "DRAFT"]);
  assert.equal(emails.length, 1);
  await act("group", "finalise-send");
  await assert.rejects(act("group", "record-payment", { amount: "120", method: "CASH", reference: "paid" }), /full invoice total/);
  assert.equal(payments.length, 0);
  await act("group", "record-payment", { amount: "240", method: "BANK_TRANSFER", reference: "BACS-001" });
  assert.deepEqual(invoices.map(row => row.status), ["PAID", "PAID", "PAID"]);
  assert.equal(payments.length, 1);
  assert.equal(payments[0].allocations.create.reduce((sum, row) => sum.add(row.amount), decimal(0)).toNumber(), 240);
  assert.equal(emails.length, 3);
  assert.equal(emails[2].invoiceNumber, "03");
  assert.equal(emails[2].pdfBuffer.toString(), "PAID");
  await assert.rejects(act("group", "record-payment", { amount: "240", method: "BANK_TRANSFER", reference: "BACS-001" }), /issued invoice/);
  assert.equal(payments.length, 1);
  assert.equal(emails.length, 3);
  console.log("Commercial week boundaries, tariff charges, consolidation, unfinalise, full-payment allocation and email isolation passed.");
}

run().catch(error => { console.error(error); process.exitCode = 1; });
