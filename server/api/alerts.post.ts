import { acknowledgeAlert } from '../services/journal'
export default defineEventHandler(async event=>{
 try{return await acknowledgeAlert((await readBody(event))?.id)}
 catch(e){throw createError({statusCode:400,statusMessage:e instanceof Error?e.message:'Pengingat tidak valid.'})}
})
