const root=process.env.FLEET_RELEASE_ROOT || process.cwd(), deps=process.env.FLEET_RELEASE_DEPS || root;
const dep=name=>require(require.resolve(name,{paths:[deps,deps+'/streamline-backend']}));
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),ts=dep('typescript');
const prismaTypes=dep('@prisma/client');
class PortalError extends Error{constructor(status,message){super(message);this.status=status;}}
let gpsSessions=[], gpsEvents=[];
let shift=null,jobs=0,audit=[],ledger=new Map(),driver={id:'d',active:true,status:'ACTIVE',vehicleId:null,portalOnDuty:false},counter=0;
const tx={
 $queryRaw:async()=>[],
 driver:{findUniqueOrThrow:async()=>driver,update:async({data})=>Object.assign(driver,data),findUnique:async()=>driver},
 booking:{findMany:async()=>gpsSessions.filter(b=>!b.trackingEndedAt),updateMany:async({data})=>{for(const b of gpsSessions)b.trackingEndedAt=data.trackingEndedAt;return{count:gpsSessions.length};},findFirst:async()=>jobs?{reference:'SL-ACTIVE'}:null,count:async()=>jobs},
 bookingTrackingEvent:{createMany:async({data})=>{gpsEvents.push(...data);return{count:data.length};}},
 driverShift:{findFirst:async()=>shift&&!shift.endedAt?shift:null,create:async({data})=>{shift={id:'s'+(++counter),driverId:'d',startedAt:data.startedAt,endedAt:null,activities:[{id:'a'+counter,...data.activities.create,endedAt:null}]};return shift;},update:async({data})=>Object.assign(shift,data)},
 driverShiftActivity:{update:async({where,data})=>Object.assign(shift.activities.find(a=>a.id===where.id),data),create:async({data})=>{const row={id:'a'+(++counter),...data,endedAt:null};shift.activities.push(row);return row;}},
 driverAttendanceRequest:{findUnique:async({where})=>ledger.get(where.driverId_requestId.requestId),create:async({data})=>{ledger.set(data.requestId,data);return data;}},
 auditLog:{create:async({data})=>audit.push(data)}
};
const mockPrisma={$transaction:async work=>work(tx)};
const code=ts.transpileModule(fs.readFileSync(root+'/streamline-backend/src/lib/driverAttendance.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText;
const moduleObject={exports:{}};
vm.runInNewContext(code,{module:moduleObject,exports:moduleObject.exports,require:name=>({'@prisma/client':prismaTypes,'./prisma':{prisma:mockPrisma},'./driverPortal':{DriverPortalError:PortalError,reconcileDriverActivity:async()=>{},requestId:value=>{if(!/^[a-z0-9_-]{16,120}$/i.test(value))throw new PortalError(400,'request');return value;}}}[name]),Date,JSON,console});
const originalApi=moduleObject.exports;
const api={...originalApi,attendanceAction:(driver,action,id,kind)=>originalApi.attendanceAction(driver,action,id.padEnd(20,'_'),kind)};
async function reject(work,status,pattern){await assert.rejects(work,e=>e.status===status&&pattern.test(e.message));}
let tests=0;async function test(name,work){await work();tests++;console.log('PASS '+name);}
function earlier(){if(shift){const open=shift.activities.find(a=>!a.endedAt);if(open)open.startedAt=new Date(Date.now()-1000);}}
(async()=>{
 await test('Clock-in does not need assigned vehicle',async()=>{const r=await api.attendanceAction('d','CLOCK_IN','request_clock_in_01');assert.equal(r.shift.id,shift.id);assert.equal(driver.portalOnDuty,true);});
 await test('Duplicate clock-in identifier returns saved result',async()=>{const count=counter;await api.attendanceAction('d','CLOCK_IN','request_clock_in_01');assert.equal(counter,count);});
 await test('Different identifier cannot create duplicate open shift',async()=>{await reject(()=>api.attendanceAction('d','CLOCK_IN','request_clock_in_02'),409,/already/);});
 await test('Identifier cannot be reused for different action',async()=>{await reject(()=>api.attendanceAction('d','START_BREAK','request_clock_in_01'),409,/different/);});
 await test('Break and resume create separate server intervals',async()=>{gpsSessions=[{id:'gps-job',status:'IN_PROGRESS',trackingEndedAt:null}];earlier();await api.attendanceAction('d','START_BREAK','request_break_01');assert.ok(gpsSessions[0].trackingEndedAt);assert.equal(gpsEvents.length,1);assert.equal(gpsEvents[0].title,'Phone sharing paused');assert.equal(shift.activities.filter(a=>!a.endedAt)[0].kind,'BREAK');const stoppedAt=gpsSessions[0].trackingEndedAt;earlier();await api.attendanceAction('d','END_BREAK','request_resume_01');assert.equal(gpsSessions[0].trackingEndedAt,stoppedAt);assert.equal(shift.activities.filter(a=>!a.endedAt)[0].kind,'WORK');});
 await test('Clock-out blocks active delivery',async()=>{jobs=1;earlier();await reject(()=>api.attendanceAction('d','CLOCK_OUT','request_out_01'),409,/SL-ACTIVE/);assert.equal(driver.portalOnDuty,true);jobs=0;});
 await test('Clock-out closes running break and shift',async()=>{earlier();await api.attendanceAction('d','START_BREAK','request_break_02');earlier();await api.attendanceAction('d','CLOCK_OUT','request_out_02');assert.ok(shift.endedAt);assert.equal(shift.activities.filter(a=>!a.endedAt).length,0);assert.equal(driver.portalOnDuty,false);});
 await test('Break outside shift rejected',async()=>{await reject(()=>api.attendanceAction('d','START_BREAK','request_break_03'),409,/Clock in/);});
 await test('Legacy duty APIs create and close attendance',async()=>{await api.legacyDuty('d',true);assert.equal(driver.portalOnDuty,true);earlier();await api.legacyDuty('d',false);assert.equal(driver.portalOnDuty,false);});
 await test('Disabled account rejected',async()=>{driver.active=false;await reject(()=>api.attendanceAction('d','CLOCK_IN','request_clock_in_03'),401,/inactive/);driver.active=true;});
 await test('Driver attribution recorded in audit',async()=>{assert.ok(audit.some(a=>a.reason.includes('Driver d')));});
 // Role enforcement uses real requireStaff implementation with an isolated session lookup.
 let session=null;
 const authCode=ts.transpileModule(fs.readFileSync(root+'/streamline-backend/src/lib/adminAccess.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
 const authModule={exports:{}};
 vm.runInNewContext(authCode,{module:authModule,exports:authModule.exports,require:name=>({'crypto':require('crypto'),'./prisma':{prisma:{adminSession:{findUnique:async()=>session}}},'./driverPortal':{DriverPortalError:PortalError}}[name]),Date});
 const staff=authModule.exports,req={headers:{authorization:'Bearer '+'a'.repeat(64)}};
 await test('Shared API key cannot access payroll',async()=>{await reject(()=>staff.requireStaff({headers:{'x-admin-key':'key'}},staff.payrollRoles),401,/Sign in/);});
 await test('Expired or inactive staff session denied',async()=>{session={expiresAt:new Date(0),admin:{active:true,role:'SUPER_ADMIN'}};await reject(()=>staff.requireStaff(req,staff.payrollRoles),401,/expired/);session={expiresAt:new Date(Date.now()+60000),admin:{active:false,role:'SUPER_ADMIN'}};await reject(()=>staff.requireStaff(req,staff.payrollRoles),401,/expired/);});
 await test('Dispatcher can view attendance but not payroll',async()=>{session={expiresAt:new Date(Date.now()+60000),admin:{active:true,role:'DISPATCHER'}};await staff.requireStaff(req,staff.attendanceRoles);await reject(()=>staff.requireStaff(req,staff.payrollRoles),403,/role/);});
 await test('Accounts role allowed payroll',async()=>{session.admin.role='ACCOUNTS';await staff.requireStaff(req,staff.payrollRoles);});
 console.log(tests+' attendance/authentication checks passed. Database races still require a real PostgreSQL test.');
})().catch(e=>{console.error(e);process.exitCode=1;});
