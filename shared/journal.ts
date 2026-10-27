import type { Candle, Holding, Settings, TradePlan } from './types'
import { cleanHistory } from './engine'
import { holdingSchedule,isTradingSession,type CalendarStatus } from './calendar'

export interface TradeInput { id:string; symbol:string; side:'BUY'|'SELL'; date:string; shares:number; price:number; fee:number; stop?:number; target?:number;holdingSessions?:number }
export interface JournalTrade extends TradeInput { recordedAt:string; gross:number; cashDelta:number; realizedPnl:number|null; basisKnown:boolean }
export interface JournalState { trades:JournalTrade[]; basis:Record<string,{shares:number;entryPrice:number;cost:number|null}> }
export interface Portfolio { settings:Settings; holdings:Holding[] }
export interface PositionMonitor { symbol:string; action:'HOLD'|'SELL'|'WAIT'; reasons:string[]; asOf:string|null; price:number|null; shares:number; estimatedGross:number|null; estimatedFees:number|null; estimatedNet:number|null; strategyVersion:string; expiry:string; actionable:boolean;holdingSessions:number;heldSessions:number|null;plannedExitDate:string|null;calendarStatus:CalendarStatus }
export interface ExitAlert { id:string;symbol:string;asOf:string;createdAt:string;acknowledgedAt:string|null;reasons:string[];shares:number;estimatedNet:number|null;strategyVersion:string;expiry:string }
const money=(n:number)=>Math.round(n*100)/100
const validDate=(s:unknown):s is string=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s
export function validateTrade(input:any,allowed:readonly string[],today:string):TradeInput {
 if(!input||typeof input!=='object'||typeof input.id!=='string'||!/^[A-Za-z0-9_-]{8,80}$/.test(input.id))throw new Error('ID transaksi tidak valid.')
 if(!allowed.includes(input.symbol)||!['BUY','SELL'].includes(input.side))throw new Error('Saham atau jenis transaksi tidak valid.')
 if(!validDate(input.date)||input.date>today)throw new Error('Tanggal transaksi harus valid dan tidak di masa depan.')
 if(isTradingSession(input.date)===false)throw new Error('Tanggal transaksi bukan sesi bursa.')
 if(!Number.isSafeInteger(input.shares)||input.shares<=0||input.shares>1e9||typeof input.price!=='number'||!Number.isFinite(input.price)||input.price<=0||input.price>1e9)throw new Error('Jumlah lembar dan harga transaksi harus positif.')
 const gross=input.shares*input.price
 if(gross>1e12||typeof input.fee!=='number'||!Number.isFinite(input.fee)||input.fee<0||input.fee>gross)throw new Error('Nilai atau biaya transaksi tidak valid.')
 for(const field of ['stop','target'])if(input[field]!=null&&(typeof input[field]!=='number'||!Number.isFinite(input[field])||input[field]<=0||input[field]>1e9))throw new Error('Stop atau target tidak valid.')
 if(input.stop!=null&&input.target!=null&&input.stop>=input.target)throw new Error('Target harus di atas stop.')
 if(input.holdingSessions!=null&&(!Number.isInteger(input.holdingSessions)||input.holdingSessions<3||input.holdingSessions>15))throw new Error('Lama pegang harus 3–15 sesi bursa.')
 return {id:input.id,symbol:input.symbol,side:input.side,date:input.date,shares:input.shares,price:input.price,fee:money(input.fee),...(input.stop!=null?{stop:input.stop}:{}),...(input.target!=null?{target:input.target}:{}),...(input.holdingSessions!=null?{holdingSessions:input.holdingSessions}:{})}
}
export function applyTrade(portfolio:Portfolio,state:JournalState,trade:TradeInput,marks:Record<string,number>,now:string):{portfolio:Portfolio;state:JournalState;duplicate:boolean} {
 const previous=state.trades.find(t=>t.id===trade.id)
 if(previous){
  const fields:(keyof TradeInput)[]=['id','symbol','side','date','shares','price','fee','stop','target','holdingSessions']
  if(fields.some(k=>previous[k]!==trade[k]))throw new Error('ID transaksi sudah dipakai untuk transaksi berbeda.')
  return {portfolio,state,duplicate:true}
 }
 const latest=state.trades.filter(t=>t.symbol===trade.symbol).at(-1)
 if(latest&&trade.date<latest.date)throw new Error('Catat transaksi saham secara berurutan menurut tanggal.')
 const holdings=portfolio.holdings.map(h=>({...h})),existing=holdings.find(h=>h.symbol===trade.symbol)
 if(existing?.openedDate&&trade.date<existing.openedDate)throw new Error('Tanggal transaksi mendahului tanggal posisi.')
 if(trade.shares%100!==0&&!(trade.side==='SELL'&&existing?.shares===trade.shares))throw new Error('Gunakan kelipatan 100 lembar, kecuali menutup seluruh sisa posisi.')
 const basis={...state.basis},known=basis[trade.symbol]
 const existingCost=existing&&known&&known.shares===existing.shares&&known.entryPrice===existing.entryPrice?known.cost:null
 const gross=money(trade.price*trade.shares),cashDelta=money(trade.side==='BUY'?-(gross+trade.fee):gross-trade.fee)
 let realizedPnl:number|null=null,basisKnown=false
 if(trade.side==='BUY'){
  if(portfolio.settings.cash+cashDelta<0)throw new Error('Dana tersedia tidak cukup untuk mencatat pembelian beserta biaya.')
  const shares=(existing?.shares??0)+trade.shares
  const entryPrice=((existing?.entryPrice??0)*(existing?.shares??0)+gross)/shares
  const holding:Holding={...(existing??{}),symbol:trade.symbol,shares,entryPrice,holdingSessions:existing?existing.holdingSessions??15:trade.holdingSessions??portfolio.settings.holdingSessions??15,...(!existing?{openedDate:trade.date}:{}),...(trade.stop!==undefined?{stop:trade.stop}:{}),...(trade.target!==undefined?{target:trade.target}:{})}
  if(existing)holdings.splice(holdings.indexOf(existing),1,holding);else holdings.push(holding)
  const cost=!existing?gross+trade.fee:existingCost!==null?existingCost+gross+trade.fee:null
  basis[trade.symbol]={shares,entryPrice,cost};basisKnown=cost!==null
 }else{
  if(!existing||trade.shares>existing.shares)throw new Error('Jumlah jual melebihi posisi yang dimiliki.')
  const soldBasis=existingCost===null?null:existingCost*trade.shares/existing.shares
  realizedPnl=soldBasis===null?null:money(cashDelta-soldBasis);basisKnown=soldBasis!==null
  const remaining=existing.shares-trade.shares
  if(remaining){existing.shares=remaining;basis[trade.symbol]={shares:remaining,entryPrice:existing.entryPrice,cost:existingCost===null?null:existingCost-soldBasis!}}
  else{holdings.splice(holdings.indexOf(existing),1);delete basis[trade.symbol]}
 }
 const cash=money(portfolio.settings.cash+cashDelta)
 // Reconcile equity to cash plus remaining positions using cached closes (entry fallback).
 const equity=money(cash+holdings.reduce((sum,h)=>sum+h.shares*(Number.isFinite(marks[h.symbol])&&marks[h.symbol]!>0?marks[h.symbol]!:h.entryPrice),0))
 return {portfolio:{settings:{...portfolio.settings,cash,equity},holdings},state:{basis,trades:[...state.trades,{...trade,recordedAt:now,gross,cashDelta,realizedPnl,basisKnown}]},duplicate:false}
}
export function monitorPositions(holdings:Holding[],plans:TradePlan[],histories:Record<string,Candle[]>,settings:Settings,expected:string):PositionMonitor[]{
 return holdings.map(h=>{
  const plan=plans.find(p=>p.symbol===h.symbol)
  let last:Candle|undefined
  try{last=cleanHistory(histories[h.symbol]??[],expected).at(-1)}catch{}
  const blocked=!plan||!last||last.date!==expected||last.volume<=0||plan.asOf!==expected||!!h.openedDate&&h.openedDate>expected||plan.reasons.some(r=>/diblokir|tidak lengkap|tidak valid/i.test(r))
  const price=last?.close??null
  const gross=!blocked&&price!==null?money(h.shares*price*(1-settings.slippagePct/100)):null
  const fees=gross===null?null:money(gross*settings.sellFeePct/100)
  const reasons=blocked?[...(plan?.reasons??[]),'Data belum cukup/terbaru; instruksi exit diblokir.']:[...plan!.reasons]
  if(h.openedDate===last?.date)reasons.push('OHLC tanggal beli mencakup seluruh sesi; sentuhan stop/target bisa terjadi sebelum pembelian. Verifikasi waktu fill.')
  const schedule=holdingSchedule(h.openedDate,h.holdingSessions??15,expected)
  return {symbol:h.symbol,action:blocked?'WAIT':plan!.action==='SELL'?'SELL':'HOLD',reasons,asOf:last?.date??null,price,shares:h.shares,estimatedGross:gross,estimatedFees:fees,estimatedNet:gross===null?null:money(gross-fees!),strategyVersion:plan?.strategyVersion??'unavailable',expiry:plan?.expiry??'UNAVAILABLE',actionable:!blocked&&plan!.action==='SELL',...schedule}
 })
}
export function mergeExitAlerts(existing:ExitAlert[],monitors:PositionMonitor[],now:string):ExitAlert[]{
 const alerts=[...existing],ids=new Set(existing.map(a=>a.id))
 for(const m of monitors){
  if(!m.actionable||m.action!=='SELL'||!m.asOf)continue
  const id=`${m.symbol}:${m.asOf}:${m.strategyVersion}:${m.shares}:${m.reasons.join('|')}`
  if(ids.has(id))continue
  ids.add(id);alerts.push({id,symbol:m.symbol,asOf:m.asOf,createdAt:now,acknowledgedAt:null,reasons:m.reasons,shares:m.shares,estimatedNet:m.estimatedNet,strategyVersion:m.strategyVersion,expiry:m.expiry})
 }
 return alerts
}
