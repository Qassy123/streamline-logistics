export async function adminFetch(input:RequestInfo|URL,options:RequestInit={}){
 const raw=input instanceof Request?input.url:String(input),base=typeof window!=="undefined"?window.location.origin:"http://localhost";
 const url=new URL(raw,base),known=[process.env.NEXT_PUBLIC_API_URL,process.env.NEXT_PUBLIC_API_BASE_URL,"https://streamline-logistics-production.up.railway.app"].filter(Boolean).map(v=>new URL(v!).origin);
 if(!url.pathname.startsWith("/api/")||!(known.includes(url.origin)||url.origin===base))return fetch(input,options);
 const headers=new Headers(input instanceof Request?input.headers:undefined);new Headers(options.headers).forEach((v,k)=>headers.set(k,v));headers.delete("x-admin-key");headers.delete("authorization");
 const target="/api/admin-proxy"+url.pathname+url.search;
 const request=input instanceof Request?new Request(new URL(target,base),input):target;
 const response=await fetch(request,{...options,headers,credentials:"same-origin",cache:"no-store"});
 if(response.status===401&&typeof window!=="undefined")window.dispatchEvent(new Event("admin-session-expired"));
 return response;
}
