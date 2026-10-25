import http from 'node:http'
const base='http://127.0.0.1:3000'
const request=async(path,body,headers={})=>{const response=await fetch(base+path,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,body:await response.json()}}
const initial=await request('/api/dashboard');if(initial.status!==200||initial.body.plans.length!==4)throw Error('Dashboard failed')
let restored=false
try{
 const payload={settings:{...initial.body.settings,cash:9000000},holdings:[{symbol:'BBCA',shares:100,entryPrice:5000,stop:4800,openedDate:'2026-10-01'}]}
 const saved=await request('/api/portfolio',payload);if(saved.status!==200)throw Error('Save failed')
 const loaded=await request('/api/dashboard');if(loaded.body.holdings[0]?.openedDate!=='2026-10-01'||loaded.body.settings.cash!==9000000)throw Error('Persistence failed')
 const invalid=await request('/api/portfolio',{...payload,settings:{...payload.settings,cash:-1}});if(invalid.status!==400)throw Error('Invalid settings accepted')
 const wrongOrigin=await request('/api/plan',payload,{Origin:'https://untrusted.example'});if(wrongOrigin.status!==403)throw Error('Origin guard failed')
 const denied=await new Promise(resolve=>http.get(base+'/api/dashboard',{headers:{Host:'public.example'}},r=>{r.resume();resolve(r.statusCode)}));if(![401,403].includes(denied))throw Error('Private access guard failed')
 const refresh=await request('/api/refresh',{});if(refresh.status!==200)throw Error('Refresh failed: '+refresh.body.statusMessage)
 const limited=await request('/api/refresh',{});if(limited.status!==503)throw Error('Refresh cooldown failed')
 console.log(JSON.stringify({dashboard:'pass',portfolioPersistence:'pass',invalidInput:'pass',crossOrigin:'pass',privateAccess:'pass',providerRefresh:'pass',refreshCooldown:'pass',observedDate:refresh.body.source.asOf}))
}finally{const restore=await request('/api/portfolio',{settings:initial.body.settings,holdings:initial.body.holdings});restored=restore.status===200;if(!restored)throw Error('Restore original portfolio failed')}


