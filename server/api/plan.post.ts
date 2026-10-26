import { dashboard, allowedSymbols } from '../services/market'
import { validatePortfolio } from '../services/validation'
export default defineEventHandler(async event=>{
 try {return await dashboard(validatePortfolio(await readBody(event), await allowedSymbols()))}catch(e){throw createError({statusCode:400,statusMessage:e instanceof Error?e.message:'Invalid request'})}
})

