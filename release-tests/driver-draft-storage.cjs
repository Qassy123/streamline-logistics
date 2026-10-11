// Transactional storage simulation: reject native Blob writes, and abort at commit.
// This does not substitute for a real iPhone Safari acceptance check.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict'),crypto=require('crypto');
const root=path.resolve(process.env.FLEET_RELEASE_ROOT||process.cwd()),deps=process.env.FLEET_RELEASE_DEPS||root;
const ts=require(require.resolve('typescript',{paths:[deps]}));
function harness(){
 const rows=new Map();let abortNext=false,writes=0,afterRead=null;
 const db={close(){},transaction(name,mode){
  const snapshot=new Map([...rows].map(([k,v])=>[k,structuredClone(v)]));let pending=0,aborted=false,scheduled=false;
  const tx={error:null,abort(){if(aborted)return;aborted=true;setImmediate(()=>tx.onabort?.());},objectStore(){return store}};
  function finish(){if(scheduled)return;scheduled=true;setImmediate(()=>{scheduled=false;if(aborted||pending)return;if(mode==='readwrite'&&abortNext){abortNext=false;tx.error=new DOMException('quota','QuotaExceededError');tx.abort();return;}if(mode==='readwrite'){rows.clear();for(const [k,v]of snapshot)rows.set(k,v)}if(mode==='readonly'&&afterRead){const fn=afterRead;afterRead=null;fn()}tx.oncomplete?.()})}
  function request(get){pending++;const req={};setImmediate(()=>{if(aborted)return;req.result=get();pending--;req.onsuccess?.();finish()});return req}
  function hasBlob(v){return v instanceof Blob||!!v&&typeof v==='object'&&Object.values(v).some(hasBlob)}
  const store={get:id=>request(()=>snapshot.get(id)),index:()=>({getAll:driver=>request(()=>[...snapshot.values()].filter(r=>r.driverId===driver))}),put(row){assert.equal(hasBlob(row),false,'No native Blob/File may reach IndexedDB');writes++;snapshot.set(row.id,structuredClone(row));finish()},delete(id){snapshot.delete(id);finish()}};
  finish();return tx;
 }};
 const indexedDB={open(){const req={result:db};setImmediate(()=>req.onsuccess());return req}};
 const module={exports:{}};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(root+'/lib/driverDrafts.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,window:{indexedDB,crypto},Blob,ArrayBuffer,WeakMap,Promise,URL,TextEncoder,Date,Error,DOMException,Set,Object,Number,JSON});
 return {api:module.exports,rows,abort(){abortNext=true},race(fn){afterRead=fn},writes:()=>writes};
}
const binding={driverId:'driver-a',kind:'COLLECTION',bookingId:'job-a',stopId:'stop-a',assignedAt:'2026-10-11T18:00:00Z',vehicleId:'van-a'};
let count=0;async function test(name,fn){await fn();count++;console.log('PASS '+name)}
(async()=>{
 const h=harness(),a=h.api,bytes=new Uint8Array([137,80,78,71,0,255]),photo=a.createDraftMedia(new Blob([bytes],{type:'image/png'}),'IMG_0475.png');
 const input={...binding,fields:{notes:'collection'},photos:[photo],capturedAt:'2026-10-11T19:45:00Z'};let saved;
 await test('Native photo persists as exact bytes with MIME/name intact',async()=>{saved=await a.saveDriverDraft(input);const raw=h.rows.get(saved.id);assert(raw.photos[0].bytes instanceof ArrayBuffer);assert.equal(raw.photos[0].blob,undefined);assert.deepEqual(new Uint8Array(raw.photos[0].bytes),bytes);assert.equal(raw.photos[0].name,'IMG_0475.png')});
 await test('Read restores the original upload payload',async()=>{const row=await a.getDriverDraft(binding);assert.equal(row.photos[0].blob.type,'image/png');assert.deepEqual(new Uint8Array(await row.photos[0].blob.arrayBuffer()),bytes)});
 await test('Stale editor cannot overwrite the draft',async()=>{await assert.rejects(a.saveDriverDraft({...input,fields:{notes:'stale'}}),/changed/);assert.equal(h.rows.get(saved.id).fields.notes,'collection')});
 await test('Quota failure never reports a committed save',async()=>{h.abort();await assert.rejects(a.saveDriverDraft({...input,fields:{notes:'lost'}},saved.revision),/out of draft storage/);assert.equal(h.rows.get(saved.id).revision,saved.revision)});
 await test('Retry succeeds with the same request identifier',async()=>{const retry=await a.saveDriverDraft(input,saved.revision);assert.equal(retry.requestId,saved.requestId);saved=retry});
 await test('Pending and upload checkpoint preserve image bytes',async()=>{saved=await a.markDraftPending(saved.id,binding.driverId,saved.revision);saved=await a.checkpointDraftUpload(saved.id,binding.driverId,saved.requestId,photo.id,'https://res.cloudinary.com/test/image/authenticated/photo.png');assert.equal(saved.photos[0].uploadedUrl,'https://res.cloudinary.com/test/image/authenticated/photo.png');assert.deepEqual(new Uint8Array(h.rows.get(saved.id).photos[0].bytes),bytes)});
 await test('Another driver cannot change or confirm the draft',async()=>{await assert.rejects(a.confirmDriverDraft(saved.id,'driver-b',saved.requestId),/not available/);assert(h.rows.has(saved.id))});
 await test('Wrong server confirmation cannot delete evidence',async()=>{await assert.rejects(a.confirmDriverDraft(saved.id,binding.driverId,crypto.randomUUID()),/another draft/);assert(h.rows.has(saved.id))});
 await test('Legacy Blob drafts remain readable and migrate on write',async()=>{const legacy={...saved,id:'legacy',phase:'EDITING',photos:[photo],signature:null};h.rows.set('legacy',legacy);const list=await a.listDriverDrafts(binding.driverId);assert(list.some(r=>r.id==='legacy'));await a.markDraftPending('legacy',binding.driverId,legacy.revision);assert(h.rows.get('legacy').photos[0].bytes instanceof ArrayBuffer)});
 await test('Signature also persists without native Blob storage',async()=>{const signature=a.createDraftMedia(new Blob([bytes],{type:'image/png'}),'signature.png');const row=await a.saveDriverDraft({...input,stopId:'stop-signature',signature});assert(h.rows.get(row.id).signature.bytes instanceof ArrayBuffer)});
 await test('Unreadable file fails before any database write',async()=>{const blob=new Blob([bytes],{type:'image/png'});blob.arrayBuffer=async()=>{throw new DOMException('file removed','NotReadableError')};const before=h.writes();await assert.rejects(a.saveDriverDraft({...input,stopId:'unreadable',photos:[a.createDraftMedia(blob)]}),/Select it again/);assert.equal(h.writes(),before)});
 await test('Concurrent edit between reading and writing is rejected',async()=>{const legacy=h.rows.get('legacy');legacy.phase='EDITING';h.race(()=>h.rows.set('legacy',{...legacy,revision:legacy.revision+1}));await assert.rejects(a.markDraftPending('legacy',binding.driverId,legacy.revision),/changed/);assert.equal(h.rows.get('legacy').phase,'EDITING')});
 await test('Only an exact confirmed request removes the draft',async()=>{await a.confirmDriverDraft(saved.id,binding.driverId,saved.requestId);assert.equal(h.rows.has(saved.id),false)});
 await test('Submission retries current form after an earlier failed save',async()=>{const page=fs.readFileSync(root+'/app/driver/jobs/[id]/page.tsx','utf8');assert(page.includes('await saveChain.current.catch(() => null);'));assert(page.includes('const row = await persist('))});
 console.log(`${count} draft storage checks passed. Real Safari verification still required.`);
})().catch(e=>{console.error(e);process.exitCode=1});
