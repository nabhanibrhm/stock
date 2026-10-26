import type { Holding, Settings } from '../../shared/types'
import { db, initStore, withStoreWrite } from './store'

type Portfolio = {settings:Settings;holdings:Holding[]}
const positionIdentity=(holdings:Holding[])=>JSON.stringify(holdings.map(({symbol,shares,entryPrice,openedDate})=>({symbol,shares,entryPrice,openedDate:openedDate??null})).sort((a,b)=>a.symbol.localeCompare(b.symbol)))

/** A stale settings form must never overwrite a committed fill. */
export async function savePortfolio(portfolio:Portfolio) {
 await initStore()
 return withStoreWrite(async()=>{
 const tx=await db().transaction('write')
 try {
  const rows=await tx.execute("SELECT key,value FROM records WHERE key IN ('portfolio','journal')")
  const records=Object.fromEntries(rows.rows.map(r=>[String(r.key),JSON.parse(String(r.value))]))
  if(records.journal?.trades?.length){
   const saved=records.portfolio as Portfolio|undefined
   if(!saved || saved.settings.cash!==portfolio.settings.cash || positionIdentity(saved.holdings)!==positionIdentity(portfolio.holdings)){
    throw new Error('Kas dan jumlah posisi dikelola jurnal transaksi. Muat ulang halaman untuk mengambil saldo terbaru; catat beli/jual melalui jurnal. Stop, target, ekuitas, dan batas risiko tetap dapat diperbarui.')
   }
  }
  await tx.execute({sql:'INSERT INTO records(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',args:['portfolio',JSON.stringify(portfolio)]})
  await tx.commit()
 }catch(error){await tx.rollback();throw error}finally{tx.close()}
 })
}
