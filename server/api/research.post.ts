import {refreshResearch} from '../services/research'
export default defineEventHandler(async event=>{
 const body=await readBody(event)
 try{return await refreshResearch(body?.symbol)}catch(error){throw createError({statusCode:503,statusMessage:error instanceof Error?error.message:'Riset belum tersedia.'})}
})
