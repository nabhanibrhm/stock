import type { Candle, Holding, Settings, Setup, TradePlan } from './types'
export type { Candle, Holding, Settings, Setup, TradePlan } from './types'
export const STRATEGY_VERSION = 'swing-eod-1.0.0'
export const defaultSettings: Settings = { cash: 10_000_000, equity: 10_000_000, riskPct: 0.5, maxPositionPct: 20, maxTotalRiskPct: 2, buyFeePct: 0.15, sellFeePct: 0.25, slippagePct: 0.1, minDailyValue: 1_000_000_000, maxPositions: 5 }
export const tickSize = (price: number): number => price < 200 ? 1 : price < 500 ? 2 : price < 2000 ? 5 : price < 5000 ? 10 : 25
export function roundPrice(price: number, direction: 'up'|'down' = 'up'): number {
  if (!Number.isFinite(price) || price <= 0) return 0
  const tick = tickSize(price)
  const rounded = (direction === 'up' ? Math.ceil(price / tick) : Math.floor(price / tick)) * tick
  // Crossing a price band must still land on its valid grid.
  return direction === 'up' ? Math.ceil(rounded / tickSize(rounded)) * tickSize(rounded) : Math.floor(rounded / tickSize(rounded)) * tickSize(rounded)
}
const mean = (values: number[]) => values.reduce((a,b) => a+b,0) / values.length
const cashRound = (n: number) => Math.round(n * 100) / 100
const validDate = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0,10) === date
export function validateSettings(s: Settings): void {
  for (const key of Object.keys(defaultSettings) as (keyof Settings)[]) if (!Number.isFinite(s[key]) || s[key] < 0) throw new Error(`Invalid setting: ${key}`)
  if (s.cash > s.equity || s.maxPositions < 1 || !Number.isInteger(s.maxPositions)) throw new Error('Equity, cash or position count is invalid')
  for (const k of ['riskPct','maxPositionPct','maxTotalRiskPct','buyFeePct','sellFeePct','slippagePct'] as const) if (s[k] >= 100) throw new Error(`Invalid percentage: ${k}`)
}
export function cleanHistory(history: Candle[], expectedDate: string): Candle[] {
  if (!validDate(expectedDate)) throw new Error('Invalid observation date')
  const rows = history.filter(c => c.date <= expectedDate).slice().sort((a,b) => a.date.localeCompare(b.date))
  const dates = new Set<string>()
  for (const c of rows) {
    if (!validDate(c.date) || dates.has(c.date) || [c.open,c.high,c.low,c.close,c.volume].some(v => !Number.isFinite(v)) || c.low <= 0 || c.low > Math.min(c.open,c.close) || c.high < Math.max(c.open,c.close) || c.low > c.high || c.volume < 0 || (c.value !== undefined && (!Number.isFinite(c.value) || c.value < 0))) throw new Error('Duplicate or invalid market records')
    dates.add(c.date)
  }
  return rows
}
export function evaluateSetup(history: Candle[], index: Candle[], expectedDate: string): Setup {
  let rows: Candle[], market: Candle[]
  const wait = (reason: string, asOf: string|null = null): Setup => ({ action:'WAIT',setup:null,entry:null,stop:null,target:null,reasons:[reason],asOf })
  try { rows = cleanHistory(history, expectedDate); market = cleanHistory(index,expectedDate) } catch { return wait('Data harga tidak valid atau duplikat') }
  const last = rows.at(-1)
  if (!last || rows.length < 60 || market.length < 60) return wait('Butuh minimal 60 sesi saham dan IHSG',last?.date ?? null)
  if (last.date !== expectedDate || market.at(-1)?.date !== expectedDate) return wait('Data belum lengkap untuk tanggal observasi',last.date)
  if (last.volume === 0) return wait('Tidak ada volume pada sesi terakhir; entry diblokir',last.date)
  const recentDates = new Set(rows.slice(-60).map(c => c.date))
  if (market.slice(-60).some(c => !recentDates.has(c.date))) return wait('Ada sesi saham yang hilang dibanding IHSG',last.date)
  const sma20 = mean(rows.slice(-20).map(c=>c.close)), sma50 = mean(rows.slice(-50).map(c=>c.close))
  if (market.at(-1)!.close <= mean(market.slice(-50).map(c=>c.close))) return wait('Filter IHSG: penutupan belum di atas SMA50',last.date)
  if (last.close <= sma20 || sma20 <= sma50) return wait('Tren belum memenuhi close > SMA20 > SMA50',last.date)
  const breakout = last.close > Math.max(...rows.slice(-21,-1).map(c=>c.high))
  const pullback = last.low <= sma20 && last.close > rows.at(-2)!.close
  if (!breakout && !pullback) return wait('Menunggu breakout 20 sesi atau pullback SMA20',last.date)
  const atr = mean(rows.slice(-14).map((c,i) => { const prior=rows[rows.length-15+i]!.close; return Math.max(c.high-c.low,Math.abs(c.high-prior),Math.abs(c.low-prior)) }))
  const entry = roundPrice(last.high + tickSize(last.high),'up')
  const stop = roundPrice(Math.max(Math.min(...rows.slice(-10).map(c=>c.low)),entry-2*atr),'down')
  if (stop <= 0 || stop >= entry || atr <= 0) return wait('Jarak stop tidak valid',last.date)
  const target = roundPrice(entry + 2*(entry-stop),'down')
  return { action:'BUY',setup:breakout?'breakout':'pullback',entry,stop,target,asOf:last.date,reasons:[breakout?'Breakout tertinggi 20 sesi':'Pullback SMA20 dengan penutupan menguat','Tren saham dan IHSG memenuhi filter','Pemicu hanya untuk sesi berikutnya; lewati gap >3% dari entry'] }
}
export function sizePosition(entry: number, stop: number, averageVolume: number, settings: Settings, cashAvailable = settings.cash, riskAvailable = settings.equity * settings.maxTotalRiskPct/100): { lots: number; estimatedCost: number; plannedRisk: number } {
  validateSettings(settings)
  const empty = {lots:0,estimatedCost:0,plannedRisk:0}
  if (![entry,stop,averageVolume,cashAvailable,riskAvailable].every(Number.isFinite) || stop<=0 || entry<=stop || averageVolume<=0) return empty
  const paid = entry*(1+settings.slippagePct/100)*(1+settings.buyFeePct/100)
  const recovered = stop*(1-settings.slippagePct/100)*(1-settings.sellFeePct/100)
  const perShareRisk = paid-recovered
  const riskBudget = Math.min(settings.equity*settings.riskPct/100,riskAvailable)
  const shareCount = Math.min(cashAvailable/paid, settings.equity*settings.maxPositionPct/100/paid,riskBudget/perShareRisk,averageVolume*0.01)
  const lots = Math.max(0,Math.floor(shareCount/100))
  return {lots,estimatedCost:cashRound(lots*100*paid),plannedRisk:cashRound(lots*100*perShareRisk)}
}
export function buildPlans(histories: Record<string,Candle[]>, index: Candle[], holdings: Holding[], settings: Settings, expectedDate: string): TradePlan[] {
  validateSettings(settings)
  // Equity is the user's total marked portfolio value, including available cash.
  // It is not inferred from entry prices; callers should update it before sizing.
  const holdingMap = new Map<string,Holding>()
  for (const h of holdings) {
    if (holdingMap.has(h.symbol) || !h.symbol || !Number.isFinite(h.shares) || !Number.isInteger(h.shares) || h.shares <= 0 || !Number.isFinite(h.entryPrice) || h.entryPrice<=0 || (h.stop!==undefined && (!Number.isFinite(h.stop)||h.stop<=0))) throw new Error('Invalid or duplicate holding')
    if (h.target !== undefined && (!Number.isFinite(h.target) || h.target <= 0)) throw new Error('Invalid holding target')
    if (h.openedDate !== undefined && (!validDate(h.openedDate) || h.openedDate > expectedDate)) throw new Error('Invalid holding opening date')
    holdingMap.set(h.symbol,h)
  }
  let availableCash=settings.cash, availableRisk=settings.equity*settings.maxTotalRiskPct/100, slots=settings.maxPositions-holdings.length
  // Existing risk uses current market value versus net stop proceeds, not original cost.
  // Unknown stop or stale holding data reserves the entire marked position value.
  for (const h of holdings) {
    let price=h.entryPrice, fresh=false
    try { const last=cleanHistory(histories[h.symbol]??[],expectedDate).at(-1); if(last){price=last.close;fresh=last.date===expectedDate} } catch { /* conservative full-value reservation below */ }
    const recovery=fresh && h.stop!==undefined ? Math.min(price,h.stop)*(1-settings.slippagePct/100)*(1-settings.sellFeePct/100) : 0
    availableRisk-=h.shares*Math.max(0,price-recovery)
  }
  return [...new Set([...Object.keys(histories),...holdingMap.keys()])].sort().map(symbol=>{
    const h=holdingMap.get(symbol), raw=histories[symbol]??[]
    const setup=evaluateSetup(raw,index,expectedDate)
    const base: TradePlan={symbol,action:'WAIT',reasons:[...setup.reasons],entry:setup.entry,stop:setup.stop,target:setup.target,lots:0,estimatedCost:0,plannedRisk:0,asOf:setup.asOf,expiry:'NEXT_TRADING_SESSION_ONLY',strategyVersion:STRATEGY_VERSION,setup:setup.setup}
    let rows: Candle[]=[]
    try {rows=cleanHistory(raw,expectedDate)} catch {return {...base,action:h?'HOLD':'WAIT',entry:h?h.entryPrice:base.entry,stop:h?h.stop??null:base.stop,target:h?h.target??null:base.target,lots:h?h.shares/100:0,reasons:['Data tidak valid; keputusan transaksi diblokir',...(h&&h.target===undefined?['Target belum diisi; exit target tidak dipantau']:[])]}}
    const last=rows.at(-1)
    if(h){
      base.action='HOLD';base.entry=h.entryPrice;base.stop=h.stop??null;base.target=h.target??null;base.lots=h.shares/100;base.estimatedCost=0;base.reasons=[]
      if(!last || last.date!==expectedDate || rows.length<60){base.reasons=['Data posisi belum lengkap; keputusan jual diblokir'];return base}
      let market: Candle[]=[]
      try {market=cleanHistory(index,expectedDate)} catch {base.reasons=['Data IHSG tidak valid; keputusan jual diblokir'];return base}
      const heldDates=new Set(rows.slice(-60).map(c=>c.date))
      if(market.length<60 || market.at(-1)?.date!==expectedDate || market.slice(-60).some(c=>!heldDates.has(c.date)) || last.volume===0){base.reasons=['Sesi posisi/IHSG tidak lengkap atau tidak ada volume; keputusan jual diblokir'];return base}
      // Opening date is held session one. After session fourteen closes, exit at session fifteen open.
      const heldSessions=h.openedDate?rows.filter(c=>c.date>=h.openedDate!).length:0
      if(h.stop!==undefined && last.low<=h.stop){
        base.action='SELL';base.reasons.push('Harga menyentuh stop posisi; verifikasi fill atau exit sesi berikutnya')
        if(h.target!==undefined && last.high>=h.target)base.reasons.push('Stop dan target tersentuh dalam sesi yang sama; urutan intraday tidak diketahui, prioritaskan tinjauan stop')
      } else if(h.target!==undefined && last.high>=h.target){
        base.action='SELL';base.reasons.push('Harga menyentuh target posisi; tinjau eksekusi atau rencana exit sesi berikutnya, fill belum terkonfirmasi')
      }
      if(last.close<mean(rows.slice(-20).map(c=>c.close))){base.action='SELL';base.reasons.push('Penutupan di bawah SMA20')}
      if(heldSessions>=14){base.action='SELL';base.reasons.push('14 sesi telah selesai; rencana exit pada pembukaan sesi ke-15 (atau segera jika terlambat)')}
      if(!base.reasons.length)base.reasons.push('Belum ada kondisi exit pada penutupan')
      if(h.target===undefined)base.reasons.push('Target belum diisi; exit target tidak dipantau')
      if(h.stop===undefined)base.reasons.push('Stop belum diisi; seluruh nilai posisi dicadangkan sebagai risiko')
      return base
    }
    if(setup.action!=='BUY')return base
    const dailyValue=mean(rows.slice(-20).map(c=>c.value??c.close*c.volume))
    if(dailyValue<settings.minDailyValue){base.reasons=['Likuiditas di bawah batas rata-rata 20 sesi'];return base}
    if(slots<=0){base.reasons=['Batas jumlah posisi tercapai'];return base}
    const sized=sizePosition(setup.entry!,setup.stop!,mean(rows.slice(-20).map(c=>c.volume)),settings,availableCash,availableRisk)
    if(!sized.lots){base.reasons=['Kas, batas posisi, atau anggaran risiko tidak cukup untuk satu lot'];return base}
    availableCash-=sized.estimatedCost;availableRisk-=sized.plannedRisk;slots--
    return {...base,...sized,action:'BUY'}
  })
}







