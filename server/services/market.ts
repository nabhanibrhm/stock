import { readFile } from 'node:fs/promises'
import { buildPlans, defaultSettings } from '../../shared/engine'
import type { Candle, Holding, Settings } from '../../shared/types'
import { readRecord, writeRecord, reserveRefresh } from './store'
import { SYMBOLS, validateCandles } from './validation'
export interface Market {histories:Record<string,Candle[]>;index:Candle[];fetchedAt:string;origin:string}
export function expectedSession(now = new Date()): string {
 const wib = new Date(now.getTime()+7*3600000)
 if (wib.getUTCHours()<18) wib.setUTCDate(wib.getUTCDate()-1)
 while([0,6].includes(wib.getUTCDay())) wib.setUTCDate(wib.getUTCDate()-1)
 return wib.toISOString().slice(0,10)
}
export async function marketData():Promise<Market> {
 const cached=await readRecord<Market>('market'); if(cached) return cached
 if(process.env.VERCEL) return {histories:{},index:[],fetchedAt:'',origin:'empty'}
 try {
  const samples=JSON.parse(await readFile('docs/arjum-samples.json','utf8'))
  const extra=JSON.parse(await readFile('docs/arjum-extra-samples.json','utf8'))
  const histories:Record<string,Candle[]>={}
  for(const symbol of SYMBOLS){const s=samples.find((s:any)=>s.path===`/api/history/${symbol}?limit=500`);if(s?.status===200)histories[symbol]=validateCandles(s.body.rows)}
  const i=extra.find((s:any)=>s.path==='/api/history/IHSG?limit=500')
  const market={histories,index:validateCandles(i.body.rows),fetchedAt:'',origin:'validation-cache'}
  await writeRecord('market',market);return market
 }catch{return {histories:{},index:[],fetchedAt:'',origin:'empty'}}
}
export async function dashboard(portfolio?:{settings:Settings;holdings:Holding[]}) {
 const market=await marketData()
 const saved=portfolio || await readRecord<{settings:Settings;holdings:Holding[]}>('portfolio') || {settings:{...defaultSettings},holdings:[]}
 const asOf=market.index.at(-1)?.date || ''
 const expected=expectedSession()
 let backtest=await readRecord<any>('backtest')
 if(!backtest && !process.env.VERCEL){try{backtest=JSON.parse(await readFile('data/backtest-report.json','utf8'))}catch{}}
 return {...market,...saved,source:{asOf,fetchedAt:market.fetchedAt,status:asOf===expected?'cached':'stale',message:`Arjum · ${market.origin}. Tanggal sesi yang diharapkan: ${expected}. Kalender sementara memakai hari kerja; hari libur bursa dapat memblokir sinyal secara konservatif. Penyesuaian aksi korporasi belum terverifikasi.`},plans:buildPlans(market.histories,market.index,saved.holdings,saved.settings,expected),backtest}
}
export async function refreshMarket() {
 const key=process.env.ARJUM_API_KEY
 if(!key) throw new Error('ARJUM_API_KEY belum dikonfigurasi di server.')
 const day=new Date(Date.now()+7*3600000).toISOString().slice(0,10)
 if(!await reserveRefresh(day,Date.now())) throw new Error('Refresh dibatasi satu kali per jam dan 20 permintaan per hari. Gunakan cache yang tersedia.')
 const histories:Record<string,Candle[]>={};let index:Candle[]=[]
 for(const symbol of [...SYMBOLS,'IHSG']) {
  let response:Response
  try {response=await fetch(`https://stock.arjum.com/api/history/${symbol}?limit=500`,{headers:{'X-API-Key':key,Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(20000)})}catch{throw new Error('Tidak dapat menghubungi Arjum. Cache sebelumnya dipertahankan.')}
  if(!response.ok) throw new Error(`Arjum mengembalikan HTTP ${response.status}. Cache sebelumnya dipertahankan.`)
  const body=await response.json(); const rows=validateCandles(body.rows)
  if(symbol==='IHSG')index=rows;else histories[symbol]=rows
 }
 await writeRecord('market',{histories,index,fetchedAt:new Date().toISOString(),origin:'arjum-rest'})
 return dashboard()
}
