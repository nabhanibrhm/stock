import { buildPlans, defaultSettings } from '../../shared/engine'
import { applyTrade, mergeExitAlerts, monitorPositions, validateTrade, type ExitAlert, type JournalState, type Portfolio } from '../../shared/journal'
import { db, initStore, withStoreWrite } from './store'
import { allowedSymbols, expectedSession, marketData } from './market'

const blank=():JournalState=>({trades:[],basis:{}})
const defaultPortfolio=():Portfolio=>({settings:{...defaultSettings},holdings:[]})
type Reader={execute:(query:any)=>Promise<any>}
async function read<T>(tx:Reader,key:string):Promise<T|null>{
 const result=await tx.execute({sql:'SELECT value FROM records WHERE key=?',args:[key]})
 return result.rows.length?JSON.parse(String(result.rows[0].value)) as T:null
}
async function put(tx:Reader,key:string,value:unknown){
 await tx.execute({sql:'INSERT INTO records(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',args:[key,JSON.stringify(value)]})
}
export async function getJournal(){
 const market=await marketData(),expected=expectedSession()
 await initStore()
 return withStoreWrite(()=>readJournal(market,expected))
}
async function readJournal(market:Awaited<ReturnType<typeof marketData>>,expected:string){
 await initStore();const tx=await db().transaction('write')
 try{
  const portfolio=await read<Portfolio>(tx,'portfolio')??defaultPortfolio()
  const state=await read<JournalState>(tx,'journal')??blank()
  const existing=await read<ExitAlert[]>(tx,'exit-alerts')??[]
  const plans=buildPlans(market.histories,market.index,portfolio.holdings,portfolio.settings,expected)
  const monitoring=monitorPositions(portfolio.holdings,plans,market.histories,portfolio.settings,expected)
  const alerts=mergeExitAlerts(existing,monitoring,new Date().toISOString())
  if(alerts.length!==existing.length)await put(tx,'exit-alerts',alerts)
  await tx.commit()
  return {trades:state.trades.slice(-500).reverse(),alerts:alerts.slice(-500).reverse(),monitoring,portfolio,totalTrades:state.trades.length,valuationNote:'Setelah transaksi dicatat, ekuitas dihitung dari kas + posisi pada harga penutupan cache (harga beli bila tidak tersedia); bukan valuasi realtime. Estimasi hasil jual memakai close dengan slippage dan biaya pengaturan, bukan fill yang dijamin. Basis biaya posisi impor tidak diketahui.'}
 }catch(e){await tx.rollback();throw e}finally{tx.close()}
}
export async function recordTrade(input:unknown){
 const market=await marketData()
 const today=new Date(Date.now()+7*3600000).toISOString().slice(0,10)
 // Existing holdings remain recordable even if they disappear from the latest catalogue.
 const allowed=await allowedSymbols()
 await withStoreWrite(async()=>{
 await initStore();const tx=await db().transaction('write')
 try{
  const portfolio=await read<Portfolio>(tx,'portfolio')??defaultPortfolio()
  const state=await read<JournalState>(tx,'journal')??blank()
  const trade=validateTrade(input,[...allowed,...portfolio.holdings.map(h=>h.symbol)],today)
  const marks=Object.fromEntries(Object.entries(market.histories).map(([symbol,rows])=>[symbol,rows.at(-1)?.close??NaN]))
  const result=applyTrade(portfolio,state,trade,marks,new Date().toISOString())
  if(!result.duplicate){await put(tx,'portfolio',result.portfolio);await put(tx,'journal',result.state)}
  await tx.commit()
 }catch(e){await tx.rollback();throw e}finally{tx.close()}
 })
 return getJournal()
}
export async function acknowledgeAlert(id:unknown){
 if(typeof id!=='string'||id.length>2000)throw new Error('ID pengingat tidak valid.')
 await withStoreWrite(async()=>{
 await initStore();const tx=await db().transaction('write')
 try{
  const alerts=await read<ExitAlert[]>(tx,'exit-alerts')??[]
  const alert=alerts.find(a=>a.id===id)
  if(!alert)throw new Error('Pengingat tidak ditemukan.')
  if(!alert.acknowledgedAt){alert.acknowledgedAt=new Date().toISOString();await put(tx,'exit-alerts',alerts)}
  await tx.commit()
 }catch(e){await tx.rollback();throw e}finally{tx.close()}
 })
 return getJournal()
}
