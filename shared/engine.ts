import type { Candle, Holding, Settings, Setup, TradePlan, UniverseAssessment } from './types'
import { holdingSchedule,nextTradingSession,isTradingSession } from './calendar'
export type { Candle, Holding, Settings, Setup, TradePlan, UniverseAssessment } from './types'
export const STRATEGY_VERSION = 'swing-eod-1.2.0'
export const defaultSettings: Settings = { cash: 10_000_000, equity: 10_000_000, riskPct: 0.5, maxPositionPct: 20, maxTotalRiskPct: 2, buyFeePct: 0.15, sellFeePct: 0.25, slippagePct: 0.1, minDailyValue: 1_000_000_000, maxPositions: 5,holdingSessions:15 }
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
  for (const key of Object.keys(defaultSettings) as (keyof Settings)[]) {const value=key==='holdingSessions'?s[key]??15:s[key];if (!Number.isFinite(value) || value! < 0) throw new Error(`Invalid setting: ${key}`)}
  if(!Number.isInteger(s.holdingSessions??15)||(s.holdingSessions??15)<3||(s.holdingSessions??15)>15)throw new Error('Holding horizon must be 3–15 sessions')
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
/** Data and liquidity admission only: a bearish IHSG does not make a stock ineligible. */
export function assessHistoryEligibility(history: Candle[], index: Candle[], minDailyValue: number, expectedDate: string): UniverseAssessment {
  if (!Number.isFinite(minDailyValue) || minDailyValue < 0) throw new Error('Invalid minimum daily value')
  const result: UniverseAssessment = {eligible:false,reasonCodes:[],reasons:[],avgDailyValue:null,historySessions:0,asOf:null,missingSessions:null,valueEstimated:false}
  const fail = (code: string, reason: string) => { result.reasonCodes.push(code); result.reasons.push(reason) }
  let rows: Candle[] = [], market: Candle[] = []
  let validHistory = true, validMarket = true
  try { rows = cleanHistory(history,expectedDate) } catch { validHistory=false;fail('invalid_history','Data saham tidak valid atau duplikat') }
  try { market = cleanHistory(index,expectedDate) } catch { validMarket=false;fail('invalid_index','Data IHSG tidak valid atau duplikat') }
  result.historySessions=rows.length;result.asOf=rows.at(-1)?.date??null
  if(validHistory){
    if(rows.length<60)fail('insufficient_history',`Riwayat saham ${rows.length}/60 sesi minimum`)
    if(rows.at(-1)?.date!==expectedDate)fail('stale_history','Data saham belum tersedia untuk tanggal observasi')
    if(rows.at(-1)?.volume===0)fail('no_volume','Tidak ada volume pada sesi saham terakhir')
    if(rows.length>=20){
      const recent=rows.slice(-20)
      result.valueEstimated=recent.some(c=>c.value===undefined)
      result.avgDailyValue=mean(recent.map(c=>c.value??c.close*c.volume))
      if(result.avgDailyValue<minDailyValue)fail('illiquid','Likuiditas di bawah batas rata-rata nilai transaksi 20 sesi')
    }
  }
  if(validMarket){
    if(market.length<60)fail('insufficient_index','Riwayat IHSG kurang dari 60 sesi; kelengkapan belum dapat diverifikasi')
    if(market.at(-1)?.date!==expectedDate)fail('stale_index','Data IHSG belum tersedia untuk tanggal observasi')
  }
  if(validHistory&&validMarket&&market.length>=60){
    const stockDates=new Set(rows.slice(-60).map(c=>c.date))
    result.missingSessions=market.slice(-60).filter(c=>!stockDates.has(c.date)).length
    if(result.missingSessions>0)fail('missing_sessions',`${result.missingSessions} sesi saham hilang dibanding 60 sesi IHSG`)
  }
  result.eligible=result.reasonCodes.length===0
  if(result.eligible)result.reasons.push('Lolos data terbaru, minimal 60 sesi selaras IHSG, dan likuiditas 20 sesi')
  if(result.valueEstimated)result.reasons.push('Sebagian nilai transaksi diperkirakan dari close × volume')
  return result
}
export function assessUniverse(histories: Record<string,Candle[]>, index: Candle[], settings: Pick<Settings,'minDailyValue'>, expectedDate: string): Record<string,UniverseAssessment> {
  return Object.fromEntries(Object.keys(histories).sort().map(symbol=>[symbol,assessHistoryEligibility(histories[symbol]!,index,settings.minDailyValue,expectedDate)]))
}
/** Uncalibrated ordering score, never a win probability. Call only on eligible history. */
export function rankSetup(history: Candle[], index: Candle[], expectedDate: string): {score:number;rankingReasons:string[]} {
  const rows=cleanHistory(history,expectedDate),market=cleanHistory(index,expectedDate)
  if(rows.length<60||market.length<60)throw new Error('Ranking requires 60 sessions')
  const last=rows.at(-1)!, marketLast=market.at(-1)!
  const stockReturn=100*(last.close/rows.at(-21)!.close-1)
  const indexReturn=100*(marketLast.close/market.at(-21)!.close-1)
  const relativeStrength=stockReturn-indexReturn
  const priorVolume=mean(rows.slice(-21,-1).map(c=>c.volume))
  const relativeVolume=priorVolume>0?last.volume/priorVolume:0
  const trendDistance=100*(last.close/mean(rows.slice(-50).map(c=>c.close))-1)
  const clip=(n:number,low:number,high:number)=>Math.max(low,Math.min(high,n))
  const score=cashRound(2*clip(relativeStrength,-20,20)+10*(clip(relativeVolume,0,5)-1)+clip(trendDistance,-20,20))
  return {score,rankingReasons:[
    `Kekuatan relatif 20 sesi vs IHSG: ${relativeStrength.toFixed(2)} poin persentase (bobot 2; batas ±20)`,
    `Volume sesi terakhir / rata-rata 20 sesi sebelumnya: ${relativeVolume.toFixed(2)}× (bobot 10 × (rasio−1); rasio dibatasi 0–5)`,
    `Jarak close dari SMA50: ${trendDistance.toFixed(2)}% (bobot 1; batas ±20)`,
    'Skor heuristik untuk urutan alokasi; bukan probabilitas keuntungan'
  ]}
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
/** Observed sessions are an explicit backtest assumption, never a live-calendar fallback. */
export function buildPlans(histories: Record<string,Candle[]>, index: Candle[], holdings: Holding[], settings: Settings, expectedDate: string, context: {calendarMode?:'observed'} = {}): TradePlan[] {
  validateSettings(settings)
  // Equity is the user's total marked portfolio value, including available cash.
  // It is not inferred from entry prices; callers should update it before sizing.
  const holdingMap = new Map<string,Holding>()
  for (const h of holdings) {
    if (holdingMap.has(h.symbol) || !h.symbol || !Number.isFinite(h.shares) || !Number.isInteger(h.shares) || h.shares <= 0 || !Number.isFinite(h.entryPrice) || h.entryPrice<=0 || (h.stop!==undefined && (!Number.isFinite(h.stop)||h.stop<=0))) throw new Error('Invalid or duplicate holding')
    if (h.target !== undefined && (!Number.isFinite(h.target) || h.target <= 0)) throw new Error('Invalid holding target')
    if (h.openedDate !== undefined && !validDate(h.openedDate)) throw new Error('Invalid holding opening date')
    if(h.holdingSessions!==undefined&&(!Number.isInteger(h.holdingSessions)||h.holdingSessions<3||h.holdingSessions>15))throw new Error('Invalid holding horizon')
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
  const candidates=[...new Set([...Object.keys(histories),...holdingMap.keys()])].map(symbol=>{
    const raw=histories[symbol]??[],h=holdingMap.get(symbol)
    const assessment=assessHistoryEligibility(raw,index,settings.minDailyValue,expectedDate)
    const setup=evaluateSetup(raw,index,expectedDate)
    const ranking=!h&&assessment.eligible&&setup.action==='BUY'?rankSetup(raw,index,expectedDate):null
    return {symbol,raw,h,assessment,setup,ranking}
  })
  // Held-position review does not release cash. Only qualified unheld setups compete
  // for new allocation; sort before sizing so scarce capital follows the ranking.
  candidates.sort((a,b)=>{
    const groupA=a.h?0:a.ranking?1:2,groupB=b.h?0:b.ranking?1:2
    return groupA-groupB || (a.ranking&&b.ranking?b.ranking.score-a.ranking.score:0) || a.symbol.localeCompare(b.symbol)
  })
  let setupRank=0
  return candidates.map(({symbol,h,raw,assessment,setup,ranking})=>{
    const horizon=h?h.holdingSessions??15:settings.holdingSessions??15
    const historical=context.calendarMode==='observed'
    const schedule=holdingSchedule(h?h.openedDate:(nextTradingSession(expectedDate)??undefined),horizon,expectedDate)
    if(historical){
      schedule.calendarStatus='historical-observed'
      schedule.plannedExitDate=null
      try{schedule.heldSessions=h?.openedDate?cleanHistory(index,expectedDate).filter(c=>c.date>=h.openedDate!).length:null}catch{schedule.heldSessions=null}
    }else if(isTradingSession(expectedDate)!==true){
      schedule.calendarStatus='unsupported'
      schedule.heldSessions=null
      schedule.plannedExitDate=null
    }
    if(!h&&schedule.calendarStatus==='missing-entry')schedule.calendarStatus='unsupported'
    const base: TradePlan={symbol,action:'WAIT',reasons:[...setup.reasons],entry:setup.entry,stop:setup.stop,target:setup.target,lots:0,estimatedCost:0,plannedRisk:0,asOf:setup.asOf,expiry:'NEXT_TRADING_SESSION_ONLY',strategyVersion:STRATEGY_VERSION,setup:setup.setup,
      rank:ranking?++setupRank:null,score:ranking?.score??null,rankingReasons:ranking?.rankingReasons??[],avgDailyValue:assessment.avgDailyValue,historySessions:assessment.historySessions,eligible:assessment.eligible,...schedule}
    let rows: Candle[]=[]
    try {rows=cleanHistory(raw,expectedDate)} catch {return {...base,action:h?'HOLD':'WAIT',entry:h?h.entryPrice:base.entry,stop:h?h.stop??null:base.stop,target:h?h.target??null:base.target,lots:h?h.shares/100:0,reasons:['Data tidak valid; keputusan transaksi diblokir',...(h&&h.target===undefined?['Target belum diisi; exit target tidak dipantau']:[])]}}
    const last=rows.at(-1)
    if(h){
      base.action='HOLD';base.entry=h.entryPrice;base.stop=h.stop??null;base.target=h.target??null;base.lots=h.shares/100;base.estimatedCost=0;base.reasons=[]
      if(h.openedDate && h.openedDate>expectedDate){base.action='WAIT';base.reasons=['Posisi dibuka setelah sesi data terakhir; tunggu data sesi pembelian selesai'];return base}
      if(schedule.calendarStatus==='invalid-entry'){base.action='WAIT';base.reasons=['Tanggal pembelian bukan sesi bursa yang valid; keputusan transaksi diblokir'];return base}
      if(!historical&&isTradingSession(expectedDate)!==true){base.action='WAIT';base.reasons=['Kalender sesi observasi tidak tersedia atau bukan sesi bursa; keputusan transaksi diblokir'];return base}
      if(!last || last.date!==expectedDate || rows.length<60){base.reasons=['Data posisi belum lengkap; keputusan jual diblokir'];return base}
      let market: Candle[]=[]
      try {market=cleanHistory(index,expectedDate)} catch {base.reasons=['Data IHSG tidak valid; keputusan jual diblokir'];return base}
      const heldDates=new Set(rows.slice(-60).map(c=>c.date))
      if(market.length<60 || market.at(-1)?.date!==expectedDate || market.slice(-60).some(c=>!heldDates.has(c.date)) || last.volume===0){base.reasons=['Sesi posisi/IHSG tidak lengkap atau tidak ada volume; keputusan jual diblokir'];return base}
      // Live schedules use the verified calendar, not truncated price history. Historical
      // evaluation before calendar coverage retains observed-session counting only.
      const heldSessions=schedule.heldSessions??0
      base.heldSessions=schedule.heldSessions
      if(h.stop!==undefined && last.low<=h.stop){
        base.action='SELL';base.reasons.push('Harga menyentuh stop posisi; verifikasi fill atau exit sesi berikutnya')
        if(h.target!==undefined && last.high>=h.target)base.reasons.push('Stop dan target tersentuh dalam sesi yang sama; urutan intraday tidak diketahui, prioritaskan tinjauan stop')
      } else if(h.target!==undefined && last.high>=h.target){
        base.action='SELL';base.reasons.push('Harga menyentuh target posisi; tinjau eksekusi atau rencana exit sesi berikutnya, fill belum terkonfirmasi')
      }
      if(last.close<mean(rows.slice(-20).map(c=>c.close))){base.action='SELL';base.reasons.push('Penutupan di bawah SMA20')}
      if(heldSessions>=horizon-1){base.action='SELL';base.reasons.push(`${horizon-1} sesi telah selesai; rencana exit pada pembukaan sesi ke-${horizon}${schedule.plannedExitDate?' ('+schedule.plannedExitDate+')':''} (atau segera jika terlambat)`)}
      if(schedule.calendarStatus==='unsupported')base.reasons.push('Kalender belum mencakup seluruh periode; tanggal dan pemicu exit waktu tidak tersedia. Periksa posisi secara manual.')
      if(schedule.calendarStatus==='missing-entry')base.reasons.push('Tanggal pembelian belum diisi; exit waktu tidak dapat dipantau.')
      if(!base.reasons.length)base.reasons.push('Belum ada kondisi exit pada penutupan')
      if(h.target===undefined)base.reasons.push('Target belum diisi; exit target tidak dipantau')
      if(h.stop===undefined)base.reasons.push('Stop belum diisi; seluruh nilai posisi dicadangkan sebagai risiko')
      return base
    }
    // Report universe admission separately, even when the market regime also blocks entry.
    if(!assessment.eligible){base.reasons=[...assessment.reasons,...setup.reasons];return base}
    if(setup.action!=='BUY')return base
    if(!historical&&schedule.calendarStatus!=='verified'){base.reasons=['Kalender belum mencakup periode masuk sampai exit; entry diblokir'];return base}
    if(slots<=0){base.reasons=['Batas jumlah posisi tercapai'];return base}
    const sized=sizePosition(setup.entry!,setup.stop!,mean(rows.slice(-20).map(c=>c.volume)),settings,availableCash,availableRisk)
    if(!sized.lots){base.reasons=['Kas, batas posisi, atau anggaran risiko tidak cukup untuk satu lot'];return base}
    availableCash-=sized.estimatedCost;availableRisk-=sized.plannedRisk;slots--
    return {...base,...sized,action:'BUY'}
  })
}







