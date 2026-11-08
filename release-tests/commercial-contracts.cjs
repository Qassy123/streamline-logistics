const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(process.env.FLEET_RELEASE_ROOT || process.cwd());
const deps = process.env.FLEET_RELEASE_DEPS || root;
const dependency = name => require(require.resolve(name, { paths: [deps, path.join(deps, "streamline-backend")] }));
const ts = dependency("typescript");
const { Prisma } = dependency("@prisma/client");
const D = n => new Prisma.Decimal(n);
const source = rel => fs.readFileSync(path.join(root, rel), "utf8");
const futureDate = new Date("2099-05-04T00:00:00Z");
const contract = {
  id: "contract", customerId: "customer", startsAt: "20:00", vehicleType: "LWB High Roof Van",
  collectionAddress: "Collection", deliveryAddress: "Delivery", purchaseOrder: "PO1",
  fare8Hours: D(280), fare12Hours: D(400), includedMiles8: D(100), includedMiles12: D(100), extraMileRate: D("1.25"),
};
const rows = [];
const links = [];
let shifts = [];
let invoice;
let invoiceLines = [];
let bookedRows = [];
let locked = false;
const prisma = {
  $transaction: async run => {
    locked = false;
    return run(prisma);
  },
  $executeRaw: async () => { locked = true; },
  booking: { createMany: async ({data}) => rows.push(...data) },
  companySettings: { findFirst: async () => ({ id:"settings", vatRate:D(20) }) },
  commercialContract: { findUnique: async () => contract },
  commercialContractShift: {
    createMany: async ({data}) => { assert.equal(data.length,rows.length); },
    findMany: async ({where, select}) => {
      const matches = shifts.filter(shift => shift.serviceDate >= (where.serviceDate.gte || new Date(0)) && shift.serviceDate < where.serviceDate.lt);
      return select ? matches.map(({serviceDate}) => ({serviceDate,contractId:contract.id})) : matches;
    },
  },
  commercialContractInvoice: {
    findMany: async () => links,
    findUnique: async ({where}) => links.find(row => row.contractId === where.contractId_month.contractId && row.month === where.contractId_month.month),
    create: async ({data}) => { assert(locked);links.push(data); },
  },
  invoice: {
    create: async ({data}) => { assert(locked);invoice={...data,id:"invoice"};return invoice; },
    update: async ({data}) => Object.assign(invoice,data),
  },
  invoiceLine: {
    deleteMany: async () => { invoiceLines = []; },
    createMany: async ({data}) => { invoiceLines=data; },
    findMany: async () => invoiceLines,
  },
  invoiceBooking: {
    deleteMany: async () => { bookedRows=[]; },
    createMany: async ({data}) => { bookedRows=data; },
  },
  invoiceAuditEvent: {create:async()=>{}},
};
function load(rel, mocks = {}) {
  const module = {exports:{}};
  const js = ts.transpileModule(source(rel), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  vm.runInNewContext(js, { module,exports:module.exports,Date,Intl,console, require: name =>
    name in mocks ? mocks[name] : name.startsWith(".") ? load(path.posix.normalize(path.posix.join(path.posix.dirname(rel),name))+".ts",mocks) : dependency(name) });
  return module.exports;
}
const billing = load("streamline-backend/src/lib/commercialContracts.ts", {
  "./prisma": {prisma}, "./invoiceNumber": {reserveInvoiceNumber:async()=>"51"},
});
const grid = load("lib/existingBookingsGrid.ts").existingBookingsGrid;
const calendar = load("lib/bookingCalendar.ts").calendarInterval;
function shift(id, day, hours, status, actualMiles, guaranteed = true, decision = null) {
  return {id,bookingId:id,serviceDate:new Date(day+"T00:00:00Z"),hours,guaranteed,
    actualMiles:actualMiles === null ? null : D(actualMiles),decision,booking:{id,reference:id,status}};
}
(async () => {
  const planned = billing.scheduledContractShifts(futureDate,new Date("2099-05-10T00:00:00Z"),[12,8,8,8,8,0,0]);
  assert.equal(planned.length,5);
  await billing.createContractShifts(prisma,contract,planned,true,"staff");
  assert.equal(rows.length,5);
  const day = rows[0].collectionDate.toISOString().slice(0,10);
  const booking = {...rows[0],collectionDate:rows[0].collectionDate.toISOString(),
    estimatedStartTime:rows[0].estimatedStartTime.toISOString(),estimatedEndTime:rows[0].estimatedEndTime.toISOString(),vehicleAvailableAt:rows[0].vehicleAvailableAt.toISOString()};
  const nextDay = new Date(+rows[0].collectionDate+86400000).toISOString().slice(0,10);
  assert.equal(+rows[0].estimatedEndTime - +rows[0].estimatedStartTime,12*3600000);
  assert.deepEqual(JSON.parse(JSON.stringify(calendar(booking,day))),{start:1200,end:1440});
  assert.deepEqual(JSON.parse(JSON.stringify(calendar(booking,nextDay))),{start:0,end:480});
  assert.equal(grid([booking],[],day)[0].items[0].assignment,"unassigned");
  assert.equal(grid([booking],[],nextDay)[0].items[0].assignment,"unassigned");
  const van={id:"van",name:"Van",vehicleType:contract.vehicleType};
  assert.equal(grid([{...booking,vehicleId:"van",status:"ASSIGNED"}],[van],day)[0].items[0].assignment,"assigned");
  console.log("PASS recurring shifts appear on Existing Bookings and preserve overnight 12-hour blocks before and after assignment.");

  shifts=[
    shift("a","2026-10-02",8,"COMPLETED",130),
    shift("b","2026-10-03",12,"CANCELLED",null),
    shift("c","2026-10-04",8,"COMPLETED",null),
    shift("d","2026-10-05",8,"CANCELLED",null,false),
  ];
  await billing.processCommercialContractBilling(new Date("2026-10-31T12:00:00Z"));
  assert.equal(links.length,0);
  await billing.processCommercialContractBilling(new Date("2026-11-01T12:00:00Z"));
  await billing.processCommercialContractBilling(new Date("2026-11-01T12:00:00Z"));
  assert.equal(links.length,1);
  assert.equal(invoice.status,"DRAFT");
  assert.equal(invoice.issuedAt.toISOString().slice(0,10),"2026-11-01");
  assert.equal(invoice.dueDate.toISOString().slice(0,10),"2026-11-15");
  assert.equal(invoice.subtotal.toFixed(2),"997.50");
  assert.equal(invoiceLines.length,3);
  assert.equal(bookedRows.length,4);
  await assert.rejects(billing.refreshContractDraft(prisma,contract,"2026-10",invoice.id,true),/Review 3 shift/);
  shifts[1].decision="BILL";
  shifts[2].actualMiles=D(50);
  shifts[3].decision="WAIVE";
  await billing.refreshContractDraft(prisma,contract,"2026-10",invoice.id,true);
  assert.equal(invoice.total.toFixed(2),"1197.00");
  assert.equal(invoiceLines.find(line=>line.chargeType==="MILEAGE").quantity.toFixed(2),"30.00");
  shifts[1].decision="WAIVE";
  await billing.refreshContractDraft(prisma,contract,"2026-10",invoice.id,true);
  assert.equal(invoice.subtotal.toFixed(2),"597.50");
  console.log("PASS one pending invoice per contract month, full guaranteed fare pending review, waiver, and excess-only mileage.");

  let contractShift = {id:"contract-shift"}, completed = false;
  const completionDb = {
    $transaction: async run => run(completionDb),
    $executeRaw: async () => {},
    $queryRaw: async () => {},
    booking: {
      findUnique: async () => ({id:"booking",status:"CONFIRMED",user:{accountType:"BUSINESS"},payments:[],totalPrice:D(280),commercialContractShift:contractShift}),
      update: async ({data}) => { completed=true;return data; },
    },
    auditLog:{create:async()=>{}},
  };
  const {reviewJob} = load("streamline-backend/src/lib/completedJobs.ts", {"./prisma":{prisma:completionDb}});
  assert.equal((await reviewJob("booking","COMPLETE","Contract shift delivered")).status,"COMPLETED");
  assert(completed);
  contractShift=null;completed=false;
  await assert.rejects(reviewJob("booking","COMPLETE","Ordinary delivery"),/must be paid in full/);
  assert.equal(completed,false);
  console.log("PASS admin can complete a monthly-billed Business contract shift while ordinary Business work still requires payment.");

  const invoiceRoutes = source("streamline-backend/src/routes/invoices.ts");
  assert(invoiceRoutes.slice(invoiceRoutes.indexOf("export async function runInvoiceReminders")).includes("commercialContractInvoice: null"));
  assert(source("streamline-backend/src/lib/monthlyTradeBilling.ts").includes("commercialContractShift: null"));
  assert(!source("streamline-backend/src/lib/commercialContracts.ts").includes("sendEmail"));
  console.log("PASS contract drafts bypass individual billing and automated email reminders.");
})().catch(error=>{console.error(error);process.exitCode=1;});
