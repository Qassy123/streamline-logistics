// Run from the project root. All suites use mock persistence; no GPS, email, Stripe or production DB calls.
const { spawnSync } = require('node:child_process');
const path=require('node:path'),fs=require('node:fs');
const root=path.resolve(process.env.FLEET_RELEASE_ROOT || process.cwd());
if(!fs.existsSync(path.join(root,'streamline-backend','src','lib','trackingState.ts')))throw Error('Run from the updated streamline-logistics project root.');
const tests=['attendance-payroll','attendance-actions','fleet-availability','vehicle-evidence','driver-workflow','tracking','tracking-browser','frontend-views','postcode','calendar-planning','google-fleet-map','driver-draft-storage','changes-12-oct','quote-maintenance-access'];
let failures=0;
for(const name of tests){console.log('\n'+name);const result=spawnSync(process.execPath,[path.join(__dirname,name+'.cjs')],{cwd:root,env:{...process.env,FLEET_RELEASE_ROOT:root},encoding:'utf8'});process.stdout.write(result.stdout||'');process.stderr.write(result.stderr||'');if(result.error){console.error(result.error);failures++;}else if(result.status!==0)failures++;}
console.log(`\n${tests.length-failures}/${tests.length} isolated suites passed. Live acceptance checks remain in docs/fleet-release-phase5-6.md.`);
process.exitCode=failures?1:0;
