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
    createMany: async ({data}) => { assert(data.every(shift => rows.some(booking => booking.id === shift.bookingId))); },
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
  vm.runInNewContext(js, { module,exports:module.exports,Date,Intl,Error,console, require: name =>
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

  await billing.createContractShifts(prisma, {...contract, deliveryAddress: ""}, planned, true, "staff");
  await billing.createContractShifts(prisma, {...contract, deliveryAddress: ""}, [planned[0]], false, "staff");
  assert.equal(rows[0].deliveryAddress, "Delivery");
  assert.equal(rows.length, 11);
  const pending = rows.slice(5);
  assert(pending.every(row => row.deliveryAddress === "" && row.status === "CONFIRMED"));
  assert.equal(grid([{...booking, deliveryAddress: ""}], [], day)[0].items.length, 1);

  const handlers = new Map();
  const router = { use() {} };
  for (const method of ["get", "post", "patch", "delete"]) router[method] = (url, fn) => handlers.set(url, fn);
  class PortalError extends Error { constructor(status, message) { super(message); this.name = "DriverPortalError"; this.status = status; } }
  let driverLookedUp = false;
  let dispatchBooking = {...pending[0], commercialContractShift: {id: "shift"}};
  const dispatchDb = {
    booking: { findUnique: async () => dispatchBooking },
    auditLog: { findFirst: async () => null },
    $queryRaw: async () => { driverLookedUp = true; },
    driver: { findUnique: async () => null },
  };
  load("streamline-backend/src/routes/adminDrivers.ts", {
    express: { Router: () => router },
    "../lib/prisma": { prisma: dispatchDb },
    "../lib/driverPortal": { DriverPortalError: PortalError, text: value => typeof value === "string" ? value.trim() : "",
      requestId: value => value, withBookingLock: async (_id, run) => run(dispatchDb) },
    "../lib/fleetOperations": { fleetMutation: async () => {} },
    "../lib/operationalSheets": {}, "../lib/adminAccess": {},
  });
  const assign = async () => {
    const result = { locals: {}, status(code) { this.code = code; return this; }, json(body) { this.body = body; } };
    await handlers.get("/:id/assign-job")({params:{id:"driver"},body:{bookingId:dispatchBooking.id,vehicleId:"van",requestId:"test"}}, result);
    return result;
  };
  const blocked = await assign();
  assert.equal(blocked.code, 409);
  assert.match(blocked.body.error, /delivery address before assigning/);
  assert.equal(driverLookedUp, false);
  const shiftBooking = {...dispatchBooking, priceAdjustment: D(0), quote: null, extraDrops: null, driverId: null,
    vehicleId: null, updatedAt: new Date("2026-11-08T12:00:00Z")};
  const editorDb = {
    $transaction: async run => run(editorDb),
    $executeRaw: async () => {},
    $queryRaw: async () => {},
    booking: {
      findUnique: async () => shiftBooking,
      findUniqueOrThrow: async () => shiftBooking,
      update: async ({data}) => Object.assign(shiftBooking, {deliveryAddress:data.deliveryAddress, totalPrice:data.totalPrice}),
    },
    companySettings: {findFirst: async () => ({vatRate:D(20)})},
    auditLog: {create: async () => {}},
  };
  const {editBooking} = load("streamline-backend/src/lib/bookingChanges.ts", {
    "./prisma": {prisma:editorDb}, "../routes/quotes": {}, "./fleetOperations": {fleetMutation: async () => {}},
    "./fleetAvailability": {}, "./bookingFinance": {},
  });
  await assert.rejects(editBooking(shiftBooking.id, {deliveryAddress:"  "}), /valid collection and delivery addresses/);
  const originalTotal = shiftBooking.totalPrice.toFixed(2);
  const saved = await editBooking(shiftBooking.id, {deliveryAddress:" New destination ", expectedUpdatedAt:shiftBooking.updatedAt.toISOString()});
  assert.equal(saved.deliveryAddress, "New destination");
  assert.equal(saved.totalPrice.toFixed(2), originalTotal);
  dispatchBooking = {...dispatchBooking, deliveryAddress:saved.deliveryAddress};
  assert.match((await assign()).body.error, /active driver/);
  assert.equal(driverLookedUp, true);
  assert.equal(pending[1].deliveryAddress, "");
  console.log("PASS variable destinations work for recurring and extra shifts, stay on the grid, and block driver assignment until provided.");

  await billing.createContractShifts(prisma, {...contract, startsAt:""}, [planned[0]], true, "staff");
  const untimed = rows.at(-1);
  assert.equal(untimed.estimatedStartTime, null);
  assert.equal(untimed.estimatedEndTime, null);
  assert.equal(untimed.collectionWindow, "");
  const asGridBooking = row => ({
    ...row, collectionDate:row.collectionDate.toISOString(), commercialContractShift:{id:"rota-shift"},
    estimatedStartTime:row.estimatedStartTime?.toISOString(), estimatedEndTime:row.estimatedEndTime?.toISOString(),
    vehicleAvailableAt:row.vehicleAvailableAt?.toISOString(),
  });
  assert.equal(grid([asGridBooking(untimed)],[],day)[0].label,"Time to be confirmed");
  dispatchBooking = {...untimed, commercialContractShift:{id:"rota-shift"}};
  assert.match((await assign()).body.error,/start time in Weekly Rota/);

  const rotaBooking = {...untimed, driverId:null, driverJourneyStartedAt:null, reservation:null, updatedAt:new Date("2026-11-08T12:00Z")};
  const previous = {serviceDate:new Date(+futureDate-7*86400000), booking:rows[0]};
  const rotaShift = {id:"rota-shift",hours:12,serviceDate:futureDate,booking:rotaBooking};
  const rotaDb = {
    commercialContract: {findFirst:async () => ({shifts:[previous,rotaShift]})},
    commercialContractShift: {findMany:async ({where}) => {
      assert.equal(where.contractId,"contract");
      assert.equal(where.contract.customerId,"customer");
      assert.equal(+where.serviceDate.gte,+futureDate);
      assert.equal(+where.serviceDate.lt,+futureDate+7*86400000);
      return where.id.in.includes(rotaShift.id) ? [rotaShift] : [];
    }},
    booking: {updateMany:async ({where,data}) => {
      assert.equal(where.id,rotaBooking.id);
      assert.equal(where.driverId,null);
      assert.equal(Object.keys(data).sort().join(","),"collectionWindow,estimatedEndTime,estimatedStartTime,vehicleAvailableAt");
      Object.assign(rotaBooking,data);
      return {count:1};
    }},
  };
  let role="OFFICE_MANAGER";
  const rotaHandlers = new Map();
  const rotaRouter = {use() {}};
  for (const method of ["get","post","patch"]) rotaRouter[method] = (url, fn) => rotaHandlers.set(method+url,fn);
  load("streamline-backend/src/routes/adminCommercialContracts.ts",{
    express:{Router:()=>rotaRouter}, "../lib/prisma":{prisma:rotaDb}, "../lib/commercialContracts":billing,
    "../lib/centralAdmin":{centralAdminAccess:()=>({admin:{role}})},
    "../lib/fleetOperations":{staffActor:()=>({}),fleetTransaction:async (_actor,_reason,run)=>run(rotaDb)},
  });
  const callRota = async (method, body) => {
    const result={status(code){this.code=code;return this;},json(payload){this.body=payload;}};
    await rotaHandlers.get(method+"/:customerId/:contractId/rota")({params:{customerId:"customer",contractId:"contract"},query:{week:day},body},result);
    return result;
  };
  const week = await callRota("get");
  assert.equal(week.body.shifts.length,1);
  assert.equal(week.body.previous.length,1);
  const payload={week:day,shifts:[{id:rotaShift.id,startsAt:"22:00",expectedUpdatedAt:rotaBooking.updatedAt.toISOString()}]};
  role="READ_ONLY";
  assert.equal((await callRota("patch",payload)).code,403);
  role="OFFICE_MANAGER";
  assert.equal((await callRota("patch",{...payload,shifts:[{...payload.shifts[0],expectedUpdatedAt:"2025-01-01T00:00Z"}]})).code,409);
  assert.equal((await callRota("patch",{...payload,shifts:[{...payload.shifts[0],id:"different-shift"}]})).code,409);
  assert.equal((await callRota("patch",payload)).body.message,"Weekly rota saved.");
  assert.equal(rotaBooking.collectionWindow,"22:00-10:00");
  assert.equal(+rotaBooking.estimatedEndTime-+rotaBooking.estimatedStartTime,12*3600000);
  assert.equal(grid([asGridBooking(rotaBooking)],[],day)[0].items[0].timed,true);
  assert.equal(calendar(asGridBooking(rotaBooking),nextDay).end,600);
  rotaBooking.driverId="driver";
  assert.equal((await callRota("patch",payload)).code,409);
  console.log("PASS weekly rota loads both weeks, schedules the existing shift overnight, and rejects stale, out-of-scope, or assigned shifts.");

  const cancellationHandlers = new Map();
  const cancellationRouter = {use() {}};
  for (const method of ["get","post","patch","delete"]) cancellationRouter[method] = (url, fn) => cancellationHandlers.set(method+url,fn);
  const cancellationBooking = {
    id:"cancel-shift-booking",status:"ASSIGNED",updatedAt:new Date(),driverId:null,vehicleId:null,reservation:{id:"hold"},
    commercialContractShift:{id:"cancel-shift",contractId:contract.id,serviceDate:futureDate,contract},
  };
  let cancelledUpdates=0, draftRefreshes=0, pendingReview=false, finalised=false;
  const cancelDb = {
    $transaction:async run => run(cancelDb),
    $executeRaw:async () => {},
    $queryRaw:async () => {},
    booking:{
      findUnique:async () => cancellationBooking,
      findUniqueOrThrow:async () => cancellationBooking,
      update:async ({data}) => {
        assert.equal(data.reservation.update.status,"CANCELLED");
        cancelledUpdates++;
        return Object.assign(cancellationBooking,{status:data.status});
      },
    },
    commercialContractInvoice:{findUnique:async () => ({invoiceId:"draft",invoice:{status:finalised?"ISSUED":"DRAFT"}})},
    commercialContractShift:{update:async ({data}) => {assert.equal(data.decision,null);pendingReview=true;}},
  };
  const cancelMocks=Object.fromEntries(["adminNewNotices","collectionSchedule","bookingSections","bookingRefunds",
    "bookingChanges","completedJobs","calendarBookingRange","driverPayroll","fleetAvailability"].map(name=>["../lib/"+name,{}]));
  load("streamline-backend/src/routes/bookings.ts",{
    ...cancelMocks, express:{Router:()=>cancellationRouter}, "../lib/prisma":{prisma:cancelDb},
    "../lib/centralAdmin":{centralAdminAccess:()=>({authorised:true,admin:{id:"staff",name:"Staff"}})},
    "../lib/commercialContracts":{refreshContractDraft:async (_tx,_contract,_month,id) => {assert.equal(id,"draft");draftRefreshes++;}},
    "../lib/driverPortal":{DriverPortalError:PortalError}, "../lib/fleetOperations":{fleetMutation:async()=>{}},
  });
  const cancel = async () => {
    const result={status(code){this.code=code;return this;},json(payload){this.body=payload;}};
    await cancellationHandlers.get("post/admin/:id/cancel")({params:{id:cancellationBooking.id}},result);
    return result;
  };
  finalised=true;
  assert.equal((await cancel()).code,409);
  finalised=false;
  cancellationBooking.status="IN_PROGRESS";
  assert.equal((await cancel()).code,409);
  assert.equal(cancelledUpdates,0);
  cancellationBooking.status="ASSIGNED";
  assert.equal((await cancel()).body.booking.status,"CANCELLED");
  assert.equal((await cancel()).body.success,true);
  assert.equal(cancelledUpdates,1);
  assert.equal(draftRefreshes,1);
  assert(pendingReview);
  console.log("PASS cancelling one shift releases its reservation, flags the draft for review, and safely handles repeat cancellation.");

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
