import { generateManualPrompt } from '../services/manual-prompts'
export default defineEventHandler(async event=>{
 try{return await generateManualPrompt(await readBody(event))}
 catch(error){throw createError({statusCode:400,statusMessage:error instanceof Error?error.message:'Prompt tidak dapat disiapkan.'})}
})
