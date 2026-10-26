import { dashboard, allowedSymbols } from '../services/market'
import { validatePortfolio } from '../services/validation'
import { savePortfolio } from '../services/portfolio'
export default defineEventHandler(async event=>{
 let portfolio, result
 try {portfolio=validatePortfolio(await readBody(event), await allowedSymbols());result=await dashboard(portfolio);await savePortfolio(portfolio)}catch(e){throw createError({statusCode:400,statusMessage:e instanceof Error?e.message:'Invalid request'})}
 return result
})

