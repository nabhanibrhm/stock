import { refreshMarket } from '../services/market'
export default defineEventHandler(async ()=>{
 try {return await refreshMarket()}catch(e){throw createError({statusCode:503,statusMessage:e instanceof Error?e.message:'Refresh failed'})}
})
