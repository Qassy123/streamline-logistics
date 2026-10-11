const root=process.env.FLEET_RELEASE_ROOT || process.cwd(), deps=process.env.FLEET_RELEASE_DEPS || root;
const dep=name=>require(require.resolve(name,{paths:[deps,deps+'/streamline-backend']}));
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const ts=dep('typescript');
const enums=dep('@prisma/client');
let state;
const fresh=()=>({id:'booking1',reference:'SL-TEST',driverId:'driver1',vehicleId:'van1',status:'ASSIGNED',
  collectionAddress:'Collection A',deliveryAddress:'Delivery B',collectionDate:new Date(),collectionWindow:'09:00-11:00',
  driverAcknowledgedAt:null,driverJourneyStartedAt:null,quote:{customerName:'Test Customer',customerPhone:'0123',extraDrops:null},
  vehicle:{id:'van1',active:true,name:'Test van',registration:'TEST',vehicleType:'Small Van'},pod:null,
  driverStops:[],driverIncidents:[],trackingEvents:[],actions:[],driver:{id:'driver1',active:true,vehicleId:'van1',portalOnDuty:true}});
function findAction(where){return state.actions.find(a=>a.driverId===where.driverId_requestId.driverId&&a.requestId===where.driverId_requestId.requestId)||null;}
const tx={
 driverShift:{findFirst:async()=>state.shiftMissing?null:{activities:[{kind:state.onBreak?"BREAK":"WORK"}]}},
 $queryRaw:async()=>[],$executeRaw:async()=>0,
 booking:{findFirst:async({where})=>where.id===state.id&&where.driverId===state.driverId?state:null,
   findUnique:async()=>state,update:async({data})=>Object.assign(state,data),count:async()=>state.status==='IN_PROGRESS'?1:0},
 driver:{findUnique:async()=>state.driver,update:async({data})=>Object.assign(state.driver,data)},
 driverStop:{createMany:async({data})=>{state.driverStops=data.map((s,i)=>({...s,id:'stop'+i,status:'PENDING',evidence:null}));},
   update:async({where,data})=>Object.assign(state.driverStops.find(s=>s.id===where.id),data),findUnique:async({where})=>state.driverStops.find(s=>s.id===where.id)},
 driverJobAction:{findUnique:async({where})=>findAction(where),create:async({data})=>{state.actions.push(data);return data;}},
 driverStopEvidence:{create:async({data})=>{const stop=state.driverStops.find(s=>s.id===data.stopId);stop.evidence={id:'collection-evidence',outcome:'DELIVERED',reviewStatus:'NOT_REQUIRED',receivedAt:new Date(),...data};return stop.evidence;},upsert:async({where,create,update})=>{const s=state.driverStops.find(s=>s.id===where.stopId);s.evidence=s.evidence?{...s.evidence,...update}:{id:'evidence1',...create};return s.evidence;},
   update:async({where,data})=>Object.assign(state.driverStops.find(s=>s.id===where.stopId).evidence,data)},
 bookingTrackingEvent:{create:async({data})=>{state.trackingEvents.push({id:'event'+state.trackingEvents.length,...data});return data;}},
 pOD:{upsert:async({create})=>{state.pod=create;return create;}},
 driverIncident:{findUnique:async()=>null,create:async({data})=>{state.driverIncidents.push(data);return data;}},
 driverPortalNotification:{create:async()=>({})},driverVehicleCheck:{findFirst:async()=>state.unsafe?{id:'unsafe-check'}:null},
};
const prisma={$transaction:async(work)=>{const snapshot=structuredClone(state);try{return await work(tx);}catch(e){state=snapshot;throw e;}},driverStop:tx.driverStop};
const moduleObj={exports:{}};
const source=fs.readFileSync(root+'/streamline-backend/src/lib/driverPortal.ts','utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
vm.runInNewContext(js,{module:moduleObj,exports:moduleObj.exports,require:p=>p==='./operationalEvidence'?{requireUploaded:async()=>{}}:p==='./prisma'?{prisma}:p==='@prisma/client'?enums:require(p),
  process:{env:{CLOUDINARY_CLOUD_NAME:'test-cloud'}},Date,URL,Intl,console});
const portal=moduleObj.exports;
let count=0;
async function rejected(work,message){await assert.rejects(work,e=>e instanceof portal.DriverPortalError&&e.message.includes(message));count++;}
let serial=0;
const action=(kind,stopId)=>portal.performDriverAction({bookingId:'booking1',driverId:'driver1',requestId:'request_'+String(++serial).padStart(16,'0'),action:kind,stopId});
const evidence=extra=>portal.submitStopEvidence({bookingId:'booking1',driverId:'driver1',stopId:'stop1',requestId:'evidence_'+String(++serial).padStart(16,'0'),
 recipientName:'Recipient',signatureUrl:'https://res.cloudinary.com/test-cloud/image/upload/v1/streamline-logistics/pod/booking1/signature.png',
 photoUrls:['https://res.cloudinary.com/test-cloud/image/upload/v1/streamline-logistics/pod/booking1/photo.jpg'],...extra});
async function arriveDelivery(){await portal.readDriverJob('booking1','driver1');await action('ACCEPT');await action('START');await action('ARRIVE','stop0');
 await action('COMPLETE_COLLECTION','stop0');await action('EN_ROUTE','stop1');await action('ARRIVE','stop1');}
(async()=>{
 state=fresh();await rejected(()=>action('START'),'Accept');await rejected(()=>action('BOGUS'),'Invalid');
 const dto=await portal.readDriverJob('booking1','driver1');assert.equal(dto.nextStop.id,'stop0');assert.equal('totalPrice' in dto,false);count++;
 const request='accept_request_00000001';await portal.performDriverAction({bookingId:'booking1',driverId:'driver1',requestId:request,action:'ACCEPT'});
 await portal.performDriverAction({bookingId:'booking1',driverId:'driver1',requestId:request,action:'ACCEPT'});assert.equal(state.actions.length,1);count++;
 await rejected(()=>portal.performDriverAction({bookingId:'booking1',driverId:'driver1',requestId:request,action:'START'}),'already been used');
 state.driver.vehicleId='other';await rejected(()=>action('START'),'Dispatch must assign');state.driver.vehicleId='van1';
 state.driver.portalOnDuty=false;await rejected(()=>action('START'),'Clock in');state.driver.portalOnDuty=true;
 state.onBreak=true;await rejected(()=>action('START'),'end your break');state.onBreak=false;
 state.shiftMissing=true;await rejected(()=>action('START'),'Clock in');state.shiftMissing=false;
 state.unsafe=true;await rejected(()=>action('START'),'unsafe defect');state.unsafe=false;
 await action('START');await rejected(()=>action('ARRIVE','stop1'),'current stop');await action('ARRIVE','stop0');await action('COMPLETE_COLLECTION','stop0');
 assert.equal(portal.safeDriverJob(state).nextStop.id,'stop1');count++;
 await action('EN_ROUTE','stop1');await action('ARRIVE','stop1');await rejected(()=>evidence({signatureUrl:''}),'signature');
 await rejected(()=>evidence({photoUrls:[]}),'photo');await rejected(()=>evidence({photoUrls:['https://example.com/photo.jpg']}),'uploaded');
 await evidence({});assert.equal(state.status,'COMPLETED');assert.equal(state.pod.status,'COMPLETED');assert.equal(state.driver.availability,'AVAILABLE');count++;
 await rejected(()=>action('START'),'closed');
 state=fresh();await arriveDelivery();await evidence({outcome:'FAILED_DELIVERY',exceptionReason:'Nobody present',signatureUrl:''});
 assert.equal(state.status,'IN_PROGRESS');assert.equal(state.driverStops[1].evidence.reviewStatus,'PENDING');count++;
 await rejected(()=>portal.reviewStopEvidence({stopId:'stop1',decision:'APPROVE',reviewedBy:'Admin',notes:'Reviewed'}),'cannot be marked delivered');
 await portal.reviewStopEvidence({stopId:'stop1',decision:'REJECT',reviewedBy:'Admin',notes:'Retry delivery'});await evidence({});
 assert.equal(state.status,'COMPLETED');assert.equal(state.driverIncidents.length,1);assert.ok(state.driverIncidents[0].notes.includes('FAILED_DELIVERY'));count++;
 state=fresh();await arriveDelivery();await evidence({outcome:'REFUSED_SIGNATURE',exceptionReason:'Recipient declined',signatureUrl:''});
 await portal.reviewStopEvidence({stopId:'stop1',decision:'APPROVE',reviewedBy:'Admin',notes:'Recipient verified by dispatch'});
 assert.equal(state.status,'COMPLETED');count++;
 state=fresh();state.quote.extraDrops=[{address:'Extra delivery C',contactName:'Drop recipient'}];state.quote.journeyType='Return';state.quote.returnAddress='Return site D';
 const multi=await portal.readDriverJob('booking1','driver1');assert.equal(multi.stops.length,4);assert.equal(multi.stops[1].contactName,'Drop recipient');count++;
 await action('ACCEPT');await action('START');await action('ARRIVE','stop0');await action('COMPLETE_COLLECTION','stop0');
 for(const stopId of ['stop1','stop2','stop3']){await action('EN_ROUTE',stopId);await action('ARRIVE',stopId);await evidence({stopId});}
 assert.equal(state.status,'COMPLETED');assert.equal(state.driverStops.filter(s=>s.evidence).length,3);assert.equal(portal.safeDriverJob(state).nextStop,null);count++;
 state=fresh();await portal.readDriverJob('booking1','driver1');state.driverId='replacement';await rejected(()=>action('ACCEPT'),'no longer assigned');
 state=fresh();state.driverAssignedAt=new Date('2026-10-07T09:00:00Z');
 portal.requireAssignmentVersion(state,'2026-10-07T09:00:00Z','van1');count++;
 assert.throws(()=>portal.requireAssignmentVersion(state,'2026-10-07T08:00:00Z','van1'),/changed this assignment/);count++;
 assert.throws(()=>portal.requireAssignmentVersion(state,'not-a-date','van1'),/changed this assignment/);count++;
 assert.throws(()=>portal.requireAssignmentVersion(state,'2026-10-07T09:00:00Z','other-van'),/changed this job/);count++;
 await rejected(()=>portal.performDriverAction({bookingId:'booking1',driverId:'driver1',requestId:'stale_assign_request_123',action:'ACCEPT',expectedAssignedAt:'2026-10-07T08:00:00Z'}),'changed this assignment');assert.equal(state.driverAcknowledgedAt,null);count++;
 state=fresh();await portal.readDriverJob('booking1','driver1');await action('ACCEPT');await action('START');await action('ARRIVE','stop0');
 const collected={bookingId:'booking1',driverId:'driver1',stopId:'stop0',action:'COMPLETE_COLLECTION',requestId:'collection_request_001',collectionEvidence:{goodsCondition:'GOOD',photoUrls:['https://res.cloudinary.com/test-cloud/image/authenticated/v1/streamline-logistics/pod/booking1/stops/stop0/photo.jpg'],notes:'Goods checked at collection'}};
 await portal.performDriverAction(collected);assert.equal(state.driverStops[0].evidence.goodsCondition,'GOOD');assert.equal(state.driverStops[0].evidence.recordedDriverId,'driver1');assert.equal(state.driverStops[0].evidence.photoUrls.length,1);count++;
 const actionCount=state.actions.length;await portal.performDriverAction(collected);assert.equal(state.actions.length,actionCount);count++;
 state=fresh();await portal.readDriverJob('booking1','driver1');await action('ACCEPT');await action('START');await action('ARRIVE','stop0');
 await rejected(()=>portal.performDriverAction({...collected,collectionEvidence:{goodsCondition:'GOOD',photoUrls:[]}}),'collection photos');assert.equal(state.driverStops[0].status,'ARRIVED');count++;
 await rejected(()=>portal.performDriverAction({...collected,collectionEvidence:{...collected.collectionEvidence,goodsCondition:'DAMAGED'}}),'describe any damage');count++;
 await portal.performDriverAction({...collected,collectionEvidence:{...collected.collectionEvidence,goodsCondition:'DAMAGED',damageNotes:'Torn carton before loading'}});assert.equal(state.driverStops[0].evidence.damageNotes,'Torn carton before loading');count++;
 console.log('Passed '+count+' driver workflow checks (isolated database mock; no live records changed).');
})().catch(error=>{console.error(error);process.exitCode=1;});
