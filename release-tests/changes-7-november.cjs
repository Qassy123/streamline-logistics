const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('node:assert/strict');
const root=path.resolve(process.env.FLEET_RELEASE_ROOT||process.cwd()),deps=process.env.FLEET_RELEASE_DEPS||root;
const dep=name=>require(require.resolve(name,{paths:[deps,deps+'/streamline-backend']}));
const ts=dep('typescript'),enums=dep('@prisma/client'),D=enums.Prisma.Decimal;
function source(rel){return fs.readFileSync(path.join(root,rel),'utf8');}
function load(rel,mocks={},extra={},append=''){const module={exports:{}};vm.runInNewContext(ts.transpileModule(source(rel)+append,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,{module,exports:module.exports,require:n=>n.endsWith('/centralAdmin')?require('./business-admin-fixture.cjs').central:n==='@/components/admin/AdminSession'?require('./business-admin-fixture.cjs').session:n==='@/lib/adminFetch'?{adminFetch:(...args)=>{const fn=((typeof extra!=='undefined'&&extra.fetch)||(typeof globals!=='undefined'&&globals.fetch));if(!fn)throw Error('No isolated fetch provided');return fn(...args);}}:n in mocks?mocks[n]:n.startsWith('.')?load(path.posix.normalize(path.posix.join(path.posix.dirname(rel),n))+'.ts',mocks,extra):dep(n),Date,Intl,Math,Set,Map,Number,Buffer,URL,Error,console,process:{env:{ADMIN_API_KEY:'test',RESEND_API_KEY:'test',STRIPE_SECRET_KEY:'sk_test_isolated_no_network'}},...extra});return module.exports;}
function router(){const routes=new Map(),obj={use(){}};for(const method of ['get','post','patch','delete'])obj[method]=(p,...handlers)=>{for(const route of Array.isArray(p)?p:[p])routes.set(method+' '+route,handlers.at(-1));};return{routes,obj};}
async function call(routes,key,{params={},body={},headers={'x-admin-key':'test'},query={},ip='test-ip'}={}){const out={status:200,headers:{}};const res={setHeader(k,v){out.headers[k]=v;},status(s){out.status=s;return res},json(data){out.body=data;return res}};await routes.get(key)({params,body,headers,query,ip},res);return out;}

const routes = router();
const records = [];
const emails = [];
const account = { id: "u", companyName: "Sample Customer Ltd", accountType: "TRADE", email: "customer@example.test" };
const amounts = { subtotal: new D(100), vatAmount: new D(20), total: new D(120) };
const invoice = (id, invoiceNumber, issuedAt) => ({
  id, invoiceNumber, issuedAt: new Date(issuedAt), createdAt: new Date(issuedAt), finalisedAt: null,
  dueDate: new Date("2026-12-15"), status: "SENT", invoiceType: "SINGLE", billingAccountType: "TRADE",
  userId: "u", user: account, booking: null, invoiceBookings: [], allocations: [], creditNotes: [],
  auditEvents: [], notes: null, ...amounts,
  lines: [
    { description: "Courier service", quantity: new D(1), unitPrice: new D(110), netAmount: new D(110), vatRate: new D(20), chargeType: "BASE_SERVICE" },
    { description: "Discount", quantity: new D(1), unitPrice: new D(10), netAmount: new D(-10), vatRate: new D(20), chargeType: "DISCOUNT" },
  ],
});
const invoices = [invoice("a", "01", "2026-11-01"), invoice("b", "02", "2026-11-18"), invoice("c", "03", "2026-10-03")];
const original = JSON.stringify(invoices);
let locked = false;
const prisma = {
  $transaction: async fn => { locked = false; return fn(prisma); },
  $executeRaw: async () => { locked = true; },
  invoice: {
    findUnique: async () => ({ invoiceType: "CONSOLIDATED" }),
    findMany: async ({ where }) => {
      assert.equal(where.invoiceType.not, "CONSOLIDATED");
      assert(!where.status.in.includes("DRAFT"));
      const range = where.OR?.[0]?.issuedAt;
      return invoices.filter(row => row.userId === where.userId &&
        (!where.id?.in || where.id.in.includes(row.id)) &&
        (!range || (row.issuedAt >= range.gte && row.issuedAt < range.lt)));
    },
  },
  invoiceAuditEvent: {
    findMany: async ({ where }) => records.filter(row => row.eventType === where.eventType &&
      (!where.invoice || row.invoice.userId === where.invoice.userId)),
    findFirst: async ({ where }) => records.find(row => row.id === where.id &&
      row.eventType === where.eventType && row.invoice.userId === where.invoice.userId),
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
  companySettings: { findFirst: async () => ({ companyName: "Streamline Logistics Group", vatRate: new D(20) }) },
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
  assert.deepEqual([...records[0].metadata.invoiceIds], ["a", "b"]);
  assert.equal((await generate("2026-11")).body.summary.id, first.body.summary.id);
  assert.equal((await generate("2026-10")).body.summary.number, "CONS-INV-02");
  assert.equal((await generate("2026-09")).status, 404);
  assert.equal((await generate("2026-13")).status, 400);
  assert.equal(emails.length, 0);
  const send = (userId, headers) => call(routes.routes, "post /admin/monthly-summary/:userId/:summaryId/send",
    { params: { userId, summaryId: first.body.summary.id }, headers });
  assert.equal((await send("other")).status, 404);
  assert.equal((await send("u", {})).status, 401);
  assert.equal((await send("u")).status, 200);
  assert.equal(emails.length, 1);
  assert.equal(emails[0].attachments[0].filename, "CONS-INV-01.pdf");
  assert.equal(emails[0].attachments[0].content.subarray(0, 4).toString(), "%PDF");
  if (process.env.NOV7_SUMMARY_PDF) fs.writeFileSync(process.env.NOV7_SUMMARY_PDF, emails[0].attachments[0].content);
  assert.equal(JSON.stringify(invoices), original);
  const accounts = await call(routes.routes, "get /admin/manual-options");
  assert.deepEqual(accounts.body.customers.map(row => row.accountType), ["BUSINESS", "TRADE"]);
  const locked = await call(routes.routes, "post /admin/:id/adjustments",
    { params: { id: "legacy" }, body: { sourceType: "ADDITIONAL_CHARGE", sourceId: "charge", quantity: 1 } });
  assert.equal(locked.status, 409);
  console.log("PASS requested month selection, separate numbering, repeated generation, email attachment, customer isolation, immutable source invoices and Business/Trade picker.");
})().catch(error => { console.error(error); process.exitCode = 1; });
