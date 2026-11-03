// Synthetic authentication for business-regression fixtures only. Never imported by application code.
// Real keys, sessions, cookies and roles are tested separately in central-admin-auth.cjs.
const crypto=require("crypto");
function access(req){const authorised=["test","test-admin-key"].includes(req.headers?.["x-admin-key"]||req.header?.("x-admin-key"));return{authorised,status:authorised?200:401,error:authorised?"":"Sign in to the admin portal.",admin:authorised?{id:"test-admin",name:"Test Admin",email:"admin@example.test",role:"SUPER_ADMIN",active:true}:undefined};}
exports.central={centralAdminAccess:access,authenticateAdmin:async req=>access(req).admin||null,adminTokenHash:token=>crypto.createHash("sha256").update(token).digest("hex"),centralTokenPattern:/^as_[a-f0-9]{64}$/};
exports.session={__esModule:true,default:({children})=>children,useAdminSession:()=>({admin:{id:"test-admin",name:"Test Admin",role:"SUPER_ADMIN",sections:[]},signOut:async()=>{}}),canAdminPage:()=>true};
