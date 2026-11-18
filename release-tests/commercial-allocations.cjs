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
  vm.runInNewContext(outputText, { exports, require: id => mocks[id] ?? deps(id), Date, console });
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
const members = id => invoices.filter(row => row.commercialGroupId === id);
const one = id => invoices.find(row => row.id === id);
const prisma = {
  $transaction: work => work(prisma),
  $queryRaw: async () => [],
  companySettings: { findFirstOrThrow: async () => ({ id: "settings" }) },
  billingProfile: { findUnique: async () => profile },
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
  "../lib/commercialAllocation": pricing,
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
