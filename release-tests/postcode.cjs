const root=process.env.FLEET_RELEASE_ROOT || process.cwd(),deps=process.env.FLEET_RELEASE_DEPS || root;
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const ts=require(require.resolve('typescript',{paths:[deps]}));
const code=ts.transpileModule(fs.readFileSync(root+'/streamline-backend/src/lib/googleMaps.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
let result;
const exportsObject={};
vm.runInNewContext(code,{exports:exportsObject,process:{env:{GOOGLE_MAPS_API_KEY:'mock'}},URL,AbortController,setTimeout,clearTimeout,fetch:async()=>({ok:true,json:async()=>({status:'OK',results:[result]})})});
function fixture(partial,postcode,precision,country='GB'){return {partial_match:partial,address_components:[{types:['country'],short_name:country},{types:['postal_code'],long_name:postcode}],geometry:{location_type:precision,location:{lat:52.9,lng:-1.8}}};}
(async()=>{
 result=fixture(true,'ST14 7FN','ROOFTOP');await exportsObject.geocodeGoogleAddress('Carters Pharmacy, 2 Carters Square, Uttoxeter, Staffordshire, ST14 7FN');
 result=fixture(true,'B9 5SY','RANGE_INTERPOLATED');await exportsObject.geocodeGoogleAddress('427 Belchers Lane, Birmingham, Birmingham, B9 5SY');
 for(const value of [fixture(true,'ST14 7FN','GEOMETRIC_CENTER'),fixture(true,'ST14 7FN','APPROXIMATE'),fixture(true,'ST14 7AA','ROOFTOP'),fixture(true,'ST14 7FN','ROOFTOP','US')]){result=value;await assert.rejects(()=>exportsObject.geocodeGoogleAddress('Carters Pharmacy, ST14 7FN'));}
 result=fixture(false,'ST14 7FN','ROOFTOP');await exportsObject.geocodeGoogleAddress('Carters Pharmacy, ST14 7FN');
 console.log('7 mocked matching checks passed; no live API calls.');
})().catch(error=>{console.error(error);process.exitCode=1;});
