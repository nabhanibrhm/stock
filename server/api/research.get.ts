import {cachedResearch} from '../services/research'
export default defineEventHandler(async event=>{
 try{return await cachedResearch(getQuery(event).symbol)}catch{throw createError({statusCode:400,statusMessage:'Kode saham riset tidak valid.'})}
})
