import { readFile } from 'node:fs/promises'
import { buildPlans, defaultSettings } from '../../shared/engine'
import type { Candle, Holding, Settings } from '../../shared/types'
import { readRecord, writeRecord, reserveRefresh } from './store'
import { SYMBOLS, validateCandles } from './validation'
import { discoverUniverse, selectUniverse, SCAN_LIMIT, SCAN_REQUEST_RESERVATION, SCAN_VERSION, type Catalog } from './universe'
import { expectedCompletedSession,CALENDAR_COVERAGE } from '../../shared/calendar'
export interface ScanInfo {discovered:number;providerTotal:number;selected:number;scanned:number;failed:string[];limit:number;source:string;asOf:string;coverage:string;catalogComplete:boolean}
export interface Market {histories:Record<string,Candle[]>;index:Candle[];fetchedAt:string;origin:string;scan?:ScanInfo;catalog?:Catalog;scanVersion?:string}
export function expectedSession(now = new Date()): string {
 const expected=expectedCompletedSession(now)
 if(!expected)throw new Error('Kalender bursa belum tersedia untuk tanggal ini. Perbarui kalender sebelum mengambil data atau membuat keputusan transaksi.')
 return expected
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
export async function allowedSymbols(){
 const market=await marketData()
 return [...new Set([...SYMBOLS,...Object.keys(market.histories),...(market.catalog?.stocks.map(s=>s.symbol)||[])])]
}
export async function dashboard(portfolio?:{settings:Settings;holdings:Holding[]}) {
 const market=await marketData()
 const rawSaved=portfolio || await readRecord<{settings:Settings;holdings:Holding[]}>('portfolio') || {settings:{...defaultSettings},holdings:[]}
 const saved={...rawSaved,settings:{...defaultSettings,...rawSaved.settings}}
 const asOf=market.index.at(-1)?.date || ''
 const expected=expectedCompletedSession()
 let backtest=await readRecord<any>('backtest')
 if(!backtest && !process.env.VERCEL){try{backtest=JSON.parse(await readFile('data/backtest-report.json','utf8'))}catch{}}
 const plans=expected?buildPlans(market.histories,market.index,saved.holdings,saved.settings,expected):[]
 const scan=market.scan || {discovered:Object.keys(market.histories).length,providerTotal:Object.keys(market.histories).length,selected:Object.keys(market.histories).length,scanned:Object.keys(market.histories).length,failed:[],limit:SCAN_LIMIT,source:'Cache pilot; perbarui untuk pemindaian luas',asOf,coverage:'Cache lama, belum pemindaian luas',catalogComplete:false}
 const {catalog,...publicMarket}=market
 return {...publicMarket,...saved,symbols:[...new Set([...Object.keys(market.histories),...saved.holdings.map(h=>h.symbol)])].sort(),universe:{...scan,eligible:plans.filter(p=>p.eligible).length,qualified:plans.filter(p=>p.rank!=null).length},source:{asOf,fetchedAt:market.fetchedAt,status:asOf===expected?'cached':'stale',expectedSession:expected,calendarStatus:expected?'verified':'unsupported',calendarCoverage:CALENDAR_COVERAGE,message:`Arjum · ${market.origin}. Sesi diharapkan: ${expected??'kalender tidak tersedia; rencana transaksi diblokir'}. Cakupan terbatas ${scan.selected} saham; bukan seluruh bursa. Kalender BEI 2026; aksi korporasi belum terverifikasi.`},plans,backtest}
}
let activeRefresh:Promise<Awaited<ReturnType<typeof dashboard>>>|undefined
export async function refreshMarket(){
 if(activeRefresh)return activeRefresh
 activeRefresh=performRefresh().finally(()=>{activeRefresh=undefined})
 return activeRefresh
}
async function performRefresh() {
 const key=process.env.ARJUM_API_KEY
 if(!key) throw new Error('ARJUM_API_KEY belum dikonfigurasi di server.')
 const day=new Date(Date.now()+7*3600000).toISOString().slice(0,10)
 if(!await reserveRefresh(day,Date.now(),SCAN_REQUEST_RESERVATION,SCAN_VERSION)) throw new Error('Pemindaian dibatasi satu kali per jam, dengan anggaran 400 permintaan per hari. Cache sebelumnya tetap tersedia.')
 let providerExhausted=false
 async function read(path:string){
  if(providerExhausted)throw new Error('Kuota provider tidak cukup untuk melanjutkan pemindaian.')
  let response:Response
  try{response=await fetch('https://stock.arjum.com'+path,{headers:{'X-API-Key':key!,Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(15000)})}catch{throw new Error('Tidak dapat menghubungi Arjum. Cache lengkap sebelumnya dipertahankan bila pemindaian gagal.')}
  const remaining=response.headers.get('x-ratelimit-remaining')
  if(response.status===429 || (remaining!==null && Number(remaining)<=5))providerExhausted=true
  if(!response.ok)throw new Error(`Arjum HTTP ${response.status}; pemindaian tidak lengkap.`)
  return response.json()
 }
 const expected=expectedSession()
 const catalog=await discoverUniverse(read,expected)
 const portfolio=await readRecord<{settings:Settings;holdings:Holding[]}>('portfolio')
 const selected=selectUniverse(catalog,portfolio?.holdings.map(h=>h.symbol)||[])
 if(!selected.length)throw new Error('Tidak ada saham dengan data turnover yang dapat dipindai.')
 const index=validateCandles((await read(`/api/history/IHSG?limit=120&end_date=${expected}`)).rows)
 if(index.at(-1)?.date!==expected)throw new Error('Data IHSG belum tersedia untuk sesi yang diharapkan; cache sebelumnya dipertahankan.')
 const histories:Record<string,Candle[]>={};const failed:string[]=[]
 // At most four concurrent provider reads; each selected symbol consumes at most one request.
 let cursor=0
 await Promise.all(Array.from({length:4},async()=>{
  while(cursor<selected.length){
   const symbol=selected[cursor++]!
   try{histories[symbol]=validateCandles((await read(`/api/history/${symbol}?limit=120&end_date=${expected}`)).rows)}
   catch{histories[symbol]=[];failed.push(symbol)}
  }
 }))
 const successful=selected.length-failed.length
 if(!successful)throw new Error('Semua riwayat saham gagal dimuat; cache sebelumnya dipertahankan.')
 const scan:ScanInfo={discovered:catalog.stocks.length,providerTotal:catalog.total,selected:selected.length,scanned:successful,failed:failed.sort(),limit:SCAN_LIMIT,source:'Katalog Arjum; prioritas turnover sesi terakhir, lalu filter riwayat & likuiditas 20 sesi',asOf:catalog.date,coverage:`${selected.length} dipilih dari ${catalog.stocks.length} kode katalog (${catalog.complete?'seluruh halaman katalog terbaca':'katalog dibatasi 25 halaman'}); ${failed.length} gagal dimuat. Posisi yang dimiliki diprioritaskan.`,catalogComplete:catalog.complete}
 await writeRecord('market',{histories,index,fetchedAt:new Date().toISOString(),origin:'arjum-broad-scan',scan,catalog,scanVersion:SCAN_VERSION})
 return dashboard()
}

