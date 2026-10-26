import { recordTrade } from '../services/journal'
export default defineEventHandler(async event=>{
 try{return await recordTrade(await readBody(event))}
 catch(e){throw createError({statusCode:400,statusMessage:e instanceof Error?e.message:'Transaksi tidak valid.'})}
})
