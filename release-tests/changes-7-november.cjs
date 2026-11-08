const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('node:assert/strict');
const root=path.resolve(process.env.FLEET_RELEASE_ROOT||process.cwd()),deps=process.env.FLEET_RELEASE_DEPS||root;
const dep=name=>require(require.resolve(name,{paths:[deps,deps+'/streamline-backend']}));
const ts=dep('typescript'),enums=dep('@prisma/client'),D=enums.Prisma.Decimal;
function source(rel){return fs.readFileSync(path.join(root,rel),'utf8');}
function load(rel,mocks={},extra={},append=''){const module={exports:{}};vm.runInNewContext(ts.transpileModule(source(rel)+append,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,{module,exports:module.exports,require:n=>n.endsWith('/centralAdmin')?require('./business-admin-fixture.cjs').central:n==='@/components/admin/AdminSession'?require('./business-admin-fixture.cjs').session:n==='@/lib/adminFetch'?{adminFetch:(...args)=>{const fn=((typeof extra!=='undefined'&&extra.fetch)||(typeof globals!=='undefined'&&globals.fetch));if(!fn)throw Error('No isolated fetch provided');return fn(...args);}}:n in mocks?mocks[n]:n.startsWith('.')?load(path.posix.normalize(path.posix.join(path.posix.dirname(rel),n))+'.ts',mocks,extra):dep(n),Date,Intl,Math,Set,Map,Number,Buffer,URL,Error,console,process:{env:{ADMIN_API_KEY:'test',RESEND_API_KEY:'test',STRIPE_SECRET_KEY:'sk_test_isolated_no_network'}},...extra});return module.exports;}
function router(){const routes=new Map(),obj={use(){}};for(const method of ['get','post','patch','delete'])obj[method]=(p,...handlers)=>{for(const route of Array.isArray(p)?p:[p])routes.set(method+' '+route,handlers.at(-1));};return{routes,obj};}
async function call(routes,key,{params={},body={},headers={'x-admin-key':'test'},query={},ip='test-ip'}={}){const out={status:200,headers:{}};const res={setHeader(k,v){out.headers[k]=v;},status(s){out.status=s;return res},json(data){out.body=data;return res},type(value){out.headers["Content-Type"]=value;return res},send(data){out.body=data;return res}};await routes.get(key)({params,body,headers,query,ip},res);return out;}

const routes = router();
const records = [];
const emails = [];
const payments = [];
const account = { id: "u", companyName: "Sample Customer Ltd", accountType: "TRADE", email: "customer@example.test" };
const amounts = { subtotal: new D(100), vatAmount: new D(20), total: new D(120) };
const invoice = (id, invoiceNumber, issuedAt) => ({
  id, invoiceNumber, issuedAt: new Date(issuedAt), createdAt: new Date(issuedAt), finalisedAt: null,
  dueDate: new Date("2026-12-15"), status: "SENT", invoiceType: "SINGLE", billingAccountType: "TRADE",
  userId: "u", user: account, booking: null, invoiceBookings: [], allocations: [], creditNotes: [],
  auditEvents: [], notes: null, ...amounts,
  lines: [
    { description: "Journey mileage (miles)", quantity: new D(1), unitPrice: new D(110), netAmount: new D(110), vatRate: new D(20), chargeType: "MILEAGE" },
    { description: "Discount", quantity: new D(1), unitPrice: new D(10), netAmount: new D(-10), vatRate: new D(20), chargeType: "DISCOUNT" },
  ],
});
const invoices = [invoice("a", "01", "2026-11-01"), invoice("b", "02", "2026-11-18"), invoice("c", "03", "2026-10-03")];
invoices[0].booking = {
  id: "job-a", reference: "SL#062", collectionDate: new Date("2026-10-23"), collectionTimeSlot: "22:00-24:00",
  collectionAddress: "Test collection address", deliveryAddress: "Test delivery address", vehicleType: "Small Van",
  specialInstructions: "Test handover", quote: null,
};
for (let i = 4; i <= 31; i++) invoices.push(invoice(`n-${i}`, String(i).padStart(2, "0"), "2026-11-01"));
const novemberIds = invoices.filter(row => row.id !== "c").map(row => row.id);
const original = JSON.stringify(invoices);
let locked = false;
const prisma = {
  $transaction: async fn => { locked = false; return fn(prisma); },
  $executeRaw: async () => { locked = true; },
  $queryRaw: async () => { assert(locked); },
  payment: { create: async ({ data }) => {
    assert(locked);
    const row = { id: `payment-${payments.length + 1}`, ...data };
    payments.push(row);
    return row;
  } },
  paymentAllocation: { createMany: async ({ data }) => {
    assert(locked);
    for (const row of data) {
      const payment = payments.find(payment => payment.id === row.paymentId);
      invoices.find(invoice => invoice.id === row.invoiceId).allocations.push({ ...row, payment });
    }
  } },
  invoice: {
    findUnique: async () => ({ invoiceType: "CONSOLIDATED" }),
    updateMany: async ({ where, data }) => {
      assert(locked);
      for (const row of invoices.filter(invoice => where.id.in.includes(invoice.id))) Object.assign(row, data);
    },
    findMany: async ({ where }) => {
      assert.equal(where.invoiceType.not, "CONSOLIDATED");
      assert.equal(where.user.is.accountType, "TRADE");
      assert(!where.status.in.includes("DRAFT"));
      const range = where.OR?.[0]?.issuedAt;
      return invoices.filter(row => row.user.accountType === where.user.is.accountType && row.userId === where.userId &&
        (!where.id?.in || where.id.in.includes(row.id)) &&
        (!range || (row.issuedAt >= range.gte && row.issuedAt < range.lt)));
    },
  },
  invoiceAuditEvent: {
    findMany: async ({ where }) => records.filter(row => row.eventType === where.eventType &&
      (!where.invoice || (row.invoice.userId === where.invoice.userId &&
        (!where.invoice.user || account.accountType === where.invoice.user.is.accountType)))),
    findFirst: async ({ where }) => records.find(row => row.id === where.id &&
      row.eventType === where.eventType && row.invoice.userId === where.invoice.userId &&
      account.accountType === where.invoice.user.is.accountType),
    update: async ({ where, data }) => {
      assert(locked);
      Object.assign(records.find(row => row.id === where.id), data);
    },
    createMany: async ({ data }) => {
      assert(locked);
      for (const row of data) records.push(row);
    },
    create: async ({ data }) => {
      if (data.eventType === "MONTHLY_INVOICE_SUMMARY") assert(locked);
      const row = { ...data, id: String(records.length + 1), invoice: { userId: "u" }, createdAt: new Date("2026-12-01") };
      records.push(row);
      return row;
    },
  },
  user: { findMany: async ({ where }) => {
    assert.equal(where, undefined);
    return [{ accountType: "BUSINESS" }, { accountType: "TRADE" }];
  }},
  companySettings: { findFirst: async () => ({ companyName: "Streamline Logistics Group", vatRate: new D(20), bankName: "Sample Bank", sortCode: "00-00-00", accountNumber: "11112222" }) },
};
const pdf = load("streamline-backend/src/lib/invoicePdf.ts", { "./prisma": { prisma } },
  { __dirname: path.join(deps, "streamline-backend/src/lib") });
load("streamline-backend/src/routes/invoices.ts", {
  "express": { Router: () => routes.obj },
  "../lib/prisma": { prisma },
  "../lib/invoicePdf": pdf,
  "../lib/email": { emailLayout: (_title, body) => body, sendEmail: async data => { emails.push(data); return { data: { id: "fake" } }; } },
  "../lib/monthlyTradeBilling": {},
});
(async () => {
  const params = { userId: "u" };
  const options = await call(routes.routes, "get /admin/monthly-summary/:userId", { params });
  assert.deepEqual([...options.body.months], ["2026-11", "2026-10"]);
  const generate = month => call(routes.routes, "post /admin/monthly-summary/:userId", { params, body: { month } });
  const first = await generate("2026-11");
  assert.equal(first.status, 201);
  assert.equal(first.body.summary.number, "CONS-INV-01");
  assert.deepEqual([...records[0].metadata.invoiceIds], novemberIds);
  assert.equal(first.body.summary.status, "DRAFT");
  assert.equal(first.body.summary.total, "3600.00");
  assert.match(first.body.summary.dueDate, /^2026-11-15T/);
  assert.equal((await generate("2026-11")).body.summary.id, first.body.summary.id);
  assert.equal((await generate("2026-10")).body.summary.number, "CONS-INV-02");
  assert.equal((await generate("2026-09")).status, 404);
  assert.equal((await generate("2026-13")).status, 400);
  assert.equal(emails.length, 0);
  const preview = (userId, headers) => call(routes.routes, "get /admin/monthly-summary/:userId/:summaryId/pdf",
    { params: { userId, summaryId: first.body.summary.id }, headers });
  assert.equal((await preview("other")).status, 404);
  assert.equal((await preview("u", {})).status, 401);
  const document = await preview("u");
  assert.equal(document.status, 200);
  assert.equal(document.headers["Content-Type"], "application/pdf");
  assert.equal(document.headers["Content-Disposition"], 'inline; filename="CONS-INV-01.pdf"');
  assert.equal(document.headers["Cache-Control"], "no-store");
  assert.equal(document.body.subarray(0, 4).toString(), "%PDF");
  assert.equal(emails.length, 0);
  const send = (userId, headers) => call(routes.routes, "post /admin/monthly-summary/:userId/:summaryId/send",
    { params: { userId, summaryId: first.body.summary.id }, headers });
  assert.equal((await send("other")).status, 404);
  assert.equal((await send("u", {})).status, 401);
  assert.equal((await send("u")).status, 409);
  const action = (name, body = {}, userId = "u", headers) => call(routes.routes, `post /admin/monthly-summary/:userId/:summaryId/${name}`,
    { params: { userId, summaryId: first.body.summary.id }, headers, body });
  assert.equal((await action("record-payment", { amount: "3600.00" })).status, 409);
  assert.equal((await action("finalise", {}, "other")).status, 404);
  const finalised = await action("finalise");
  assert.equal(finalised.status, 200);
  assert.equal(finalised.body.summary.status, "FINALISED");
  assert.equal((await send("u")).status, 200);
  assert.equal(emails.length, 1);
  assert.equal(emails[0].attachments[0].filename, "CONS-INV-01.pdf");
  assert.equal(emails[0].attachments[0].content.subarray(0, 4).toString(), "%PDF");
  if (process.env.NOV7_SUMMARY_PDF) fs.writeFileSync(process.env.NOV7_SUMMARY_PDF, emails[0].attachments[0].content);
  assert.equal(JSON.stringify(invoices), original);
  account.accountType = "BUSINESS";
  const businessOptions = await call(routes.routes, "get /admin/monthly-summary/:userId", { params });
  assert.equal(businessOptions.body.months.length, 0);
  assert.equal(businessOptions.body.summaries.length, 0);
  assert.equal((await generate("2026-11")).status, 404);
  assert.equal((await preview("u")).status, 404);
  assert.equal((await send("u")).status, 404);
  assert.equal(emails.length, 1);
  account.accountType = "TRADE";
  assert.equal(JSON.stringify(invoices), original);
  for (const amount of ["3599.99", "3600.01", "120", "3600.001"]) {
    assert.equal((await action("record-payment", { amount })).status, 400);
  }
  assert.equal(JSON.stringify(invoices), original);
  assert.equal(payments.length, 0);
  assert.equal((await action("record-payment", { amount: "3600.00" }, "other")).status, 404);
  assert.equal((await action("record-payment", { amount: "3600.00" }, "u", {})).status, 401);
  const changed = invoices[0];
  changed.allocations.push({ amount: new D(10) });
  assert.equal((await action("record-payment", { amount: "3590.00" })).status, 409);
  changed.allocations.pop();
  const paid = await action("record-payment", { amount: "3600.00", paidAt: "2026-11-12" });
  assert.equal(paid.status, 201);
  assert.equal(paid.body.summary.status, "PAID");
  assert.equal(payments.length, 1);
  assert.equal(payments[0].amount.toFixed(2), "3600.00");
  assert.equal(payments[0].reference, "CONS-INV-01");
  assert.equal(payments[0].paymentMethod, "BANK_TRANSFER");
  for (const row of invoices.filter(invoice => novemberIds.includes(invoice.id))) {
    assert.equal(row.status, "PAID");
    assert.equal(row.allocations.length, 1);
    assert.equal(row.allocations[0].paymentId, payments[0].id);
    assert.equal(row.allocations[0].amount.toFixed(2), "120.00");
  }
  assert.equal(invoices.find(row => row.id === "c").status, "SENT");
  assert.equal((await action("record-payment", { amount: "3600.00" })).status, 409);
  assert.equal(payments.length, 1);
  const afterPayment = await call(routes.routes, "get /admin/monthly-summary/:userId", { params });
  assert.equal(afterPayment.body.summaries.find(row => row.id === first.body.summary.id).status, "PAID");
  if (process.env.NOV7_PAID_SUMMARY_PDF) fs.writeFileSync(process.env.NOV7_PAID_SUMMARY_PDF, (await preview("u")).body);
  if (process.env.NOV7_SINGLE_PDF) fs.writeFileSync(process.env.NOV7_SINGLE_PDF, await pdf.renderInvoicePdf(invoices[0]));
  const accounts = await call(routes.routes, "get /admin/manual-options");
  assert.deepEqual(accounts.body.customers.map(row => row.accountType), ["BUSINESS", "TRADE"]);
  const locked = await call(routes.routes, "post /admin/:id/adjustments",
    { params: { id: "legacy" }, body: { sourceType: "ADDITIONAL_CHARGE", sourceId: "charge", quantity: 1 } });
  assert.equal(locked.status, 409);
  console.log("PASS Trade consolidated invoices start pending, finalise, render and email, reject short or excess payment, and clear all 30 included invoices with one transfer.");
})().catch(error => { console.error(error); process.exitCode = 1; });
