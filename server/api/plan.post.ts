import { dashboard } from '../services/market'
import { validatePortfolio } from '../services/validation'
export default defineEventHandler(async event=>{
 try {return await dashboard(validatePortfolio(await readBody(event)))}catch(e){throw createError({statusCode:400,statusMessage:e instanceof Error?e.message:'Invalid request'})}
})
