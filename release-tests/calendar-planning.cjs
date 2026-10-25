const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const deps=process.env.FLEET_RELEASE_DEPS || process.cwd();
const ts=require(require.resolve('typescript',{paths:[deps]}));
const root=path.resolve(process.env.FLEET_RELEASE_ROOT || process.cwd());
function load(file){const module={exports:{}};const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;vm.runInNewContext(code,{module,exports:module.exports,require:()=>({}),Intl,Date,Number,Math,String,console});return module.exports;}
const {calendarInterval,dropCollectionWindow}=load(root+'/lib/bookingCalendar.ts');let count=0;
function check(name,fn){fn();count++;console.log('PASS '+name);}
function interval(start,end,day='2026-10-11'){return calendarInterval({estimatedStartTime:start,estimatedEndTime:end,collectionDate:day,collectionWindow:'22:00-24:00'},day);}
check('22:00 to midnight remains visible',()=>assert.equal(JSON.stringify(interval('2026-10-11T21:00:00Z','2026-10-11T23:00:00Z')),JSON.stringify({start:1320,end:1440})));
check('Six-hour overnight booking clipped on collection day',()=>assert.equal(JSON.stringify(interval('2026-10-11T21:00:00Z','2026-10-12T03:00:00Z')),JSON.stringify({start:1320,end:1440})));
check('Overnight carryover appears on next day',()=>assert.equal(JSON.stringify(interval('2026-10-11T21:00:00Z','2026-10-12T03:00:00Z','2026-10-12')),JSON.stringify({start:0,end:240})));
check('Booking ending at day start is excluded',()=>assert.equal(interval('2026-10-10T17:00:00Z','2026-10-10T23:00:00Z'),null));
check('Booking starting at next midnight is excluded',()=>assert.equal(interval('2026-10-11T23:00:00Z','2026-10-12T05:00:00Z'),null));
check('Missing timestamps use collection window and six-hour span',()=>assert.equal(JSON.stringify(interval(null,null)),JSON.stringify({start:1320,end:1440})));
check('Legacy inverted end still reserves the minimum six hours',()=>assert.equal(JSON.stringify(interval('2026-10-11T21:00:00Z','2026-10-11T20:00:00Z')),JSON.stringify({start:1320,end:1440})));
check('UK summer time does not use browser timezone',()=>assert.equal(JSON.stringify(interval('2026-07-01T20:00:00Z','2026-07-01T23:00:00Z','2026-07-01')),JSON.stringify({start:1260,end:1440})));
check('UK winter midnight is visible',()=>assert.equal(JSON.stringify(interval('2026-12-01T22:00:00Z','2026-12-02T00:00:00Z','2026-12-01')),JSON.stringify({start:1320,end:1440})));
check('DST spring carryover clips by UK calendar day',()=>assert.equal(JSON.stringify(interval('2026-03-28T22:00:00Z','2026-03-29T04:00:00Z','2026-03-29')),JSON.stringify({start:0,end:300})));
check('DST autumn carryover clips by UK calendar day',()=>assert.equal(JSON.stringify(interval('2026-10-24T21:00:00Z','2026-10-25T04:00:00Z','2026-10-25')),JSON.stringify({start:0,end:240})));
check('21:00 drop no longer rounds to 22:00',()=>assert.equal(dropCollectionWindow(2101,100),'21:00-23:00'));
check('Every hourly drop selects its exact hour',()=>{for(let h=0;h<=22;h++)assert.equal(dropCollectionWindow(h*100+50,100),`${String(h).padStart(2,'0')}:00-${String(h+2).padStart(2,'0')}:00`)});
check('Drops outside timeline clamp safely',()=>{assert.equal(dropCollectionWindow(-30,100),'00:00-02:00');assert.equal(dropCollectionWindow(2499,100),'22:00-24:00')});
const {ukMidnight}=load(root+'/streamline-backend/src/lib/driverPayroll.ts');
check('Backend UK bounds preserve DST day lengths',()=>{assert.equal((+ukMidnight('2026-03-30')-+ukMidnight('2026-03-29'))/3600000,23);assert.equal((+ukMidnight('2026-10-26')-+ukMidnight('2026-10-25'))/3600000,25)});
const list=fs.readFileSync(root+'/app/admin/bookings/page.tsx','utf8');
check('Calendar loads all pages and renders every fetched booking in a list',()=>{assert.match(list,/while \(page <= totalPages\)/);assert.match(list,/bookings\.map\(booking => <button/);assert.match(list,/calendar: "true"/)});
const planning=fs.readFileSync(root+'/app/admin/planning-board/page.tsx','utf8');
check('Drop only selects; creation requires explicit button',()=>{const drop=planning.slice(planning.indexOf('async function handleDraftDrop'),planning.indexOf('async function submitDraft'));assert.doesNotMatch(drop,/await|createUnassignedBooking|assignExactVehicle/);assert.match(planning,/>Create booking<\/button>/)});
check('Saved booking prevents a duplicate creation after assignment failure',()=>{assert.match(planning,/createdBookingId \|\| savedDraftReference\) return/);assert.match(planning,/setSavedDraftReference\(newBooking.reference\);\s*await assignExactVehicle/)});
console.log(count+' calendar/planning regression checks passed.');
