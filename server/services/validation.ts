import type { Candle, Holding, Settings } from '../../shared/types'
import { defaultSettings } from '../../shared/engine'
export const SYMBOLS = ['BBCA','BBRI','TLKM','ANTM']
export function validateCandles(input: unknown): Candle[] {
 if (!Array.isArray(input) || input.length < 20 || input.length > 2000) throw new Error('Invalid history size')
 const dates = new Set<string>()
 return input.map((r: any) => {
  if (!r || typeof r.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(r.date) || dates.has(r.date)) throw new Error('Invalid history dates')
  const values = ['open','high','low','close','volume']
  if (values.some(k => typeof r[k] !== 'number' || !Number.isFinite(r[k])) || r.low <= 0 || r.high < r.low || r.open < r.low || r.open > r.high || r.close < r.low || r.close > r.high || r.volume < 0) throw new Error('Invalid OHLCV')
  dates.add(r.date)
  return { date:r.date,open:r.open,high:r.high,low:r.low,close:r.close,volume:r.volume,...(Number.isFinite(r.value)?{value:r.value}:{}) }
 }).sort((a,b)=>a.date.localeCompare(b.date))
}
export function validatePortfolio(body: any): {settings:Settings,holdings:Holding[]} {
 if (!body || typeof body !== 'object' || !body.settings || !Array.isArray(body.holdings)) throw new Error('Pengaturan dan posisi diperlukan.')
 const settings = {...defaultSettings} as Settings
 for (const key of Object.keys(defaultSettings) as (keyof Settings)[]) {
  const value=body.settings[key]
  if(typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1e12) throw new Error('Nilai pengaturan tidak valid: '+key)
  ;(settings as any)[key]=value
 }
 if (settings.cash > settings.equity) throw new Error('Total ekuitas portofolio harus minimal sebesar Dana tersedia. Jika belum punya saham, isi keduanya dengan jumlah yang sama.')
 if (settings.riskPct > 5) throw new Error('Risiko / trade harus antara 0% dan 5%.')
 if (settings.maxTotalRiskPct > 20) throw new Error('Total risiko terbuka harus antara 0% dan 20%.')
 if (settings.maxPositionPct > 100) throw new Error('Batas posisi harus antara 0% dan 100%.')
 if (settings.buyFeePct > 5) throw new Error('Biaya beli harus antara 0% dan 5%.')
 if (settings.sellFeePct > 5) throw new Error('Biaya jual harus antara 0% dan 5%.')
 if (settings.slippagePct > 5) throw new Error('Slippage harus antara 0% dan 5%.')
 if (settings.maxPositions < 1 || settings.maxPositions > 20 || !Number.isInteger(settings.maxPositions)) throw new Error('Maksimal posisi harus bilangan bulat antara 1 dan 20.')
 const seen=new Set<string>()
 const holdings:Holding[]=body.holdings.map((h:any)=>{
  if(!h || !SYMBOLS.includes(h.symbol) || seen.has(h.symbol) || !Number.isInteger(h.shares) || h.shares<=0 || h.shares>1e9 || !Number.isFinite(h.entryPrice) || h.entryPrice<=0 || (h.stop!=null && (!Number.isFinite(h.stop)||h.stop<=0))) throw new Error('Posisi tidak valid. Gunakan saham universe, jumlah lembar positif, dan simbol unik.')
  if(h.openedDate!=null && (typeof h.openedDate!=='string' || !/^\d{4}-\d{2}-\d{2}$/.test(h.openedDate) || !Number.isFinite(Date.parse(h.openedDate)) || new Date(h.openedDate).toISOString().slice(0,10)!==h.openedDate)) throw new Error('Tanggal beli tidak valid.')
  if(h.target!=null && (!Number.isFinite(h.target)||h.target<=0)) throw new Error('Target posisi tidak valid.')
  seen.add(h.symbol); return {symbol:h.symbol,shares:h.shares,entryPrice:h.entryPrice,...(h.stop!=null?{stop:h.stop}:{}),...(h.target!=null?{target:h.target}:{}),...(h.openedDate?{openedDate:h.openedDate}:{})}
 })
 return {settings,holdings}
}




