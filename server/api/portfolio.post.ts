import { dashboard } from '../services/market'
import { validatePortfolio } from '../services/validation'
import { writeRecord } from '../services/store'
export default defineEventHandler(async event=>{
 let portfolio, result
 try {portfolio=validatePortfolio(await readBody(event));result=await dashboard(portfolio)}catch(e){throw createError({statusCode:400,statusMessage:e instanceof Error?e.message:'Invalid request'})}
 await writeRecord('portfolio',portfolio)
 return result
})
