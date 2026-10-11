const root=process.env.FLEET_RELEASE_ROOT || process.cwd(), deps=process.env.FLEET_RELEASE_DEPS || root;
const dep=name=>require(require.resolve(name,{paths:[deps,deps+'/streamline-backend']}));
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),ts=dep('typescript');
class E extends Error{constructor(status,message){super(message);this.status=status;}}
function load(p,imports){const m={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:m,exports:m.exports,require:p=>imports[p]||require(p),Date,Intl,console});return m.exports;}
const libraryRoot=root+'/streamline-backend/src/lib/';const reservation=load(libraryRoot+'reservationWindow.ts',{}),fleet=load(libraryRoot+'fleetAvailability.ts',{'./driverPortal':{DriverPortalError:E},'./reservationWindow':reservation});
function matches(row,w={}){return Object.entries(w).every(([k,v])=>k==='OR'?v.some(x=>matches(row,x)):k==='AND'?v.every(x=>matches(row,x)):v&&typeof v==='object'&&!(v instanceof Date)?Object.entries(v).every(([op,x])=>({in:()=>x.includes(row[k]),not:()=>row[k]!==x,lt:()=>row[k]<x,gt:()=>row[k]>x}[op]?.()??false)):row[k]===v);}
let data;const db={companySettings:{findFirst:async()=>({vehicleBlockHours:2})}};for(const table of ['vehicle','driver','booking','vehicleReservation','driverVehicleAllocation','vehicleMaintenanceRecord','driverVehicleCheck'])db[table]={findMany:async({where,take})=>data[table].filter(v=>matches(v,where)).slice(0,take||Infinity),findUnique:async({where})=>data[table].find(v=>matches(v,where))||null};
const d=hour=>new Date(`2026-10-12T${String(hour).padStart(2,'0')}:00:00Z`),now=d(7);function reset(){data={vehicle:[{id:'v',vehicleType:'Small Van',active:true,status:'AVAILABLE'},{id:'other',vehicleType:'Small Van',active:true,status:'AVAILABLE'}],driver:[{id:'driver',active:true,status:'ACTIVE'}],booking:[],vehicleReservation:[],driverVehicleAllocation:[],vehicleMaintenanceRecord:[],driverVehicleCheck:[]};}
const allocation={vehicleId:'v',driverId:'driver',startsAt:d(9),endsAt:d(10),cancelledAt:null};const opts={startsAt:d(11),endsAt:d(12),purpose:'ALLOCATION'};
async function rows(extra={}){return fleet.readFleetAvailability(db,{...opts,...extra},now);}
let count=0;async function test(name,f){reset();await f();console.log('PASS '+name);count++;}
(async()=>{
 await test('09:00 allocation stays blocked after 10:00 until 15:00',async()=>{data.driverVehicleAllocation=[allocation];const r=await rows();assert.equal(r[0].available,false);assert.equal(r[0].unavailableUntil.toISOString(),d(15).toISOString());});
 await test('15:00 is the release boundary',async()=>{data.driverVehicleAllocation=[allocation];assert.equal((await rows({startsAt:d(15),endsAt:d(16)}))[0].available,true);});
 await test('short legacy reservation also blocks to 15:00',async()=>{data.vehicleReservation=[{vehicleId:'v',status:'CONFIRMED',reservedFrom:d(9),reservedUntil:d(10),expiresAt:null}];assert.equal((await rows())[0].unavailableUntil.toISOString(),d(15).toISOString());});
 await test('completed short booking retains six-hour hold',async()=>{data.booking=[{id:'b',vehicleId:'v',status:'COMPLETED',estimatedStartTime:d(9),estimatedEndTime:d(10)}];assert.equal((await rows())[0].available,false);});
 await test('cancellation releases only allocation',async()=>{data.driverVehicleAllocation=[{...allocation,cancelledAt:now}];assert.equal((await rows())[0].available,true);});
 await test('busy driver does not make another van look booked',async()=>{data.driverVehicleAllocation=[allocation];const r=await rows({driverId:'driver'});assert.equal(r[1].vanAvailable,true);assert.equal(r[1].available,false);assert.ok(r[1].driverReasons.length);});
 await test('longer recorded job cannot release while still occupied',async()=>{data.driverVehicleAllocation=[{...allocation,endsAt:d(18)}];assert.equal((await rows())[0].unavailableUntil.toISOString(),d(18).toISOString());});
 await test('new short allocation reserves its next six hours',async()=>{data.driverVehicleAllocation=[{...allocation,startsAt:d(14),endsAt:d(15)}];assert.equal((await rows())[0].available,false);});
 await test('current Fleet view does not look ahead six hours',async()=>{data.driverVehicleAllocation=[{...allocation,startsAt:d(12),endsAt:d(13)}];assert.equal((await rows({purpose:'CURRENT',endsAt:new Date(+d(11)+1)}))[0].available,true);});
 await test('quote duration is six hours regardless of old setting',async()=>{const r=reservation.getReservationWindow('2026-10-12','09:00-10:00',2);assert.equal(+r.reservedUntil-+r.reservedFrom,6*3600000);});
 console.log(count+' six-hour checks passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
