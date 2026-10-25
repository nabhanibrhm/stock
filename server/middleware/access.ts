import { timingSafeEqual } from 'node:crypto'
export default defineEventHandler(event=>{
 const host=getRequestHeader(event,'host') || ''
 const local=/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host) && !process.env.VERCEL && !process.env.APP_PASSWORD
 if(!local){
  const password=process.env.APP_PASSWORD
  const auth=getRequestHeader(event,'authorization') || ''
  let supplied='';try{supplied=Buffer.from(auth.replace(/^Basic /,''),'base64').toString().split(':').slice(1).join(':')}catch{}
  const a=Buffer.from(supplied),b=Buffer.from(password||'')
  if(!password || a.length!==b.length || !timingSafeEqual(a,b)) {setResponseHeader(event,'WWW-Authenticate','Basic realm="Arus private"');throw createError({statusCode:401,statusMessage:'Private app: configure APP_PASSWORD and sign in.'})}
 }
 if(event.path.startsWith('/api/')) {
  setResponseHeader(event,'Cache-Control','no-store')
  if(!['GET','HEAD'].includes(event.method)){
   const origin=getRequestHeader(event,'origin')
   if(origin && new URL(origin).host!==host) throw createError({statusCode:403,statusMessage:'Cross-origin request rejected'})
   if(!(getRequestHeader(event,'content-type')||'').includes('application/json'))throw createError({statusCode:415,statusMessage:'JSON required'})
  }
 }
})
