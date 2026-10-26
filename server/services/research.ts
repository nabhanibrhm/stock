import {brokerContext,financialContext,providerAnalysis,emptySection,RESEARCH_VERSION,type ResearchReport} from '../../shared/research'
import {allowedSymbols,expectedSession} from './market'
import {readRecord,writeRecord,reserveResearch} from './store'
export const RESEARCH_REQUEST_COST=7
const inFlight=new Map<string,Promise<ResearchReport>>()
export function researchPaths(symbol:string,expected:string){
 const start=new Date(Date.parse(expected)-30*86400000).toISOString().slice(0,10)
 return [
  `/api/broker-summary/${symbol}?flow=F&start_date=${expected}&end_date=${expected}&broker_limit=5&level_limit=1`,
  `/api/broker-summary/${symbol}?flow=D&start_date=${expected}&end_date=${expected}&broker_limit=5&level_limit=1`,
  `/api/broker-accumulation/${symbol}?top=3&start_date=${start}&end_date=${expected}`,
  ...['INCOME_STATEMENT','BALANCE_SHEET','CASH_FLOW_REPORT'].map(type=>`/api/financial-statements/${symbol}?report_type=${type}&period=quarterly&limit=2`),
  `/api/analysis/${symbol}`
 ]
}
export function researchFromResponses(symbol:string,bodies:any[],expected:string,fetchedAt:string):ResearchReport {
 return {symbol,fetchedAt,expectedSession:expected,broker:brokerContext(symbol,bodies[0],bodies[1],bodies[2],expected),financial:financialContext(symbol,bodies[3],bodies[4],bodies[5],expected),analysis:providerAnalysis(symbol,bodies[6],expected),notes:['Konteks Arjum tambahan; tidak mengubah BUY/SELL, peringkat, atau ukuran posisi. Bukan penilaian kesehatan perusahaan lengkap.','Maksimal tujuh permintaan per pembaruan saham; cache satu jam berbagi anggaran harian dengan pemindaian.']}
}
async function validSymbol(input:unknown){
 if(typeof input!=='string'||! /^[A-Z]{4}$/.test(input)||!(await allowedSymbols()).includes(input))throw new Error('Pilih kode saham yang tersedia dalam katalog.')
 return input
}
export async function cachedResearch(input:unknown):Promise<ResearchReport>{
 const symbol=await validSymbol(input);const expected=expectedSession()
 const cached=await readRecord<ResearchReport>(`research:${RESEARCH_VERSION}:${symbol}`)
 if(!cached)return {symbol,fetchedAt:'',expectedSession:expected,broker:emptySection('Belum dimuat. Klik muat konteks Arjum.'),financial:emptySection('Belum dimuat. Klik muat konteks Arjum.'),analysis:providerAnalysis(symbol,null,expected),notes:['Data riset dimuat sesuai permintaan; tidak memicu transaksi.']}
 cached.analysis=cached.analysis?providerAnalysis(symbol,{stock_code:symbol,output:cached.analysis.output},expected):providerAnalysis(symbol,null,expected)
 cached.notes=cached.notes.map(note=>note.replace('Maksimal enam permintaan per pembaruan saham','Maksimal tujuh permintaan per pembaruan saham'))
 if(cached.expectedSession!==expected){cached.broker.status=cached.broker.items.length?'stale':'unavailable';cached.broker.notes=[...cached.broker.notes,`Cache berasal dari sesi ${cached.expectedSession}; sesi diharapkan ${expected}.`];cached.notes=[...cached.notes,'Cache riset belum diperbarui untuk sesi ini.']}
 if(cached.financial.asOf&&(Date.parse(expected)-Date.parse(cached.financial.asOf))/86400000>200&&cached.financial.items.length)cached.financial.status='stale'
 return {...cached,expectedSession:expected}
}
export async function refreshResearch(input:unknown):Promise<ResearchReport>{
 const symbol=await validSymbol(input)
 const active=inFlight.get(symbol);if(active)return active
 const task=performRefresh(symbol).finally(()=>inFlight.delete(symbol));inFlight.set(symbol,task);return task
}
async function performRefresh(symbol:string){
 const expected=expectedSession();const now=Date.now()
 const cache=await readRecord<ResearchReport>(`research:${RESEARCH_VERSION}:${symbol}`)
 if(cache&&now-Date.parse(cache.fetchedAt)<3600000&&cache.expectedSession===expected)return cachedResearch(symbol)
 const key=process.env.ARJUM_API_KEY
 if(!key)throw new Error('ARJUM_API_KEY belum dikonfigurasi di server.')
 const day=new Date(now+7*3600000).toISOString().slice(0,10)
 if(!await reserveResearch(day,now,RESEARCH_REQUEST_COST,symbol))throw new Error('Riset dibatasi satu kali per saham per jam dan anggaran bersama 400 permintaan per hari. Cache tetap tersedia.')
 let exhausted=false
 const bodies:any[]=[];const errors:string[]=[]
 const paths=researchPaths(symbol,expected)
 const labels=['Broker asing','Broker domestik','Akumulasi broker','Laba rugi','Neraca','Arus kas','Analisa Arjum']
 for(let i=0;i<paths.length;i++){
  if(exhausted){bodies.push(null);errors.push(`${labels[i]}: tidak dimuat karena batas kuota.`);continue}
  try{
   const response=await fetch('https://stock.arjum.com'+paths[i],{headers:{'X-API-Key':key,Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(15000)})
   const remaining=response.headers.get('x-ratelimit-remaining')
   if(response.status===429||(remaining!==null&&Number(remaining)<=5))exhausted=true
   if(!response.ok)throw new Error('Provider unavailable')
   bodies.push(await response.json())
  }catch{bodies.push(null);errors.push(`${labels[i]}: gagal dimuat; tidak diganti data lama.`)}
 }
 if(bodies.every(b=>b===null))throw new Error('Seluruh sumber riset gagal dimuat. Cache sebelumnya dipertahankan.')
 const report=researchFromResponses(symbol,bodies,expected,new Date(now).toISOString())
 report.notes.push(...errors)
 await writeRecord(`research:${RESEARCH_VERSION}:${symbol}`,report)
 return report
}
