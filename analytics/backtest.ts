import { buildPlans, defaultSettings, validateSettings, cleanHistory } from '../shared/engine';
import type { Candle, Holding, Settings, TradePlan } from '../shared/types';

export interface Trade {
  symbol: string; signalDate: string; entryDate: string; exitDate: string;
  entry: number; exit: number; shares: number; netPnl: number; returnPct: number;
  reason: string; holdingSessions: number;
}
export interface BacktestResult {
  startDate: string; endDate: string; initialEquity: number; finalEquity: number;
  totalReturnPct: number; maxDrawdownPct: number; tradeCount: number; winRatePct: number;
  netProfit: number; expectancy: number; turnover: number; benchmarkReturnPct: number;
  exposurePct: number; equityCurve: {date: string; equity: number; cash: number; benchmarkEquity: number}[];
  trades: Trade[]; skippedEntries: number;
  openPositions: {symbol:string;shares:number;entry:number;mark:number;unrealizedNetPnl:number}[];
}
type Planner = typeof buildPlans;
interface Position {symbol: string; shares: number; entry: number; stop: number; target: number; cost: number; entryDate: string; signalDate: string; age: number; mark: number}
interface Pending {plan: TradePlan; signalDate: string}
export interface BacktestOptions {initialEquity?: number; settings?: Partial<Settings>; maxHoldingSessions?: number; planner?: Planner}
const sorted = (rows: Candle[]) => [...rows].sort((a,b) => a.date.localeCompare(b.date));
const locked = (bar: Candle) => bar.volume <= 0 || bar.high === bar.low;
const round = (n: number) => Math.round(n * 100) / 100;

/** All signals are computed after the close and may execute only on the following index session. */
export function runBacktest(histories: Record<string,Candle[]>, index: Candle[], startDate: string, endDate: string, options: BacktestOptions = {}): BacktestResult {
  const initialEquity = options.initialEquity ?? 10_000_000;
  const settings = {...defaultSettings, ...options.settings, cash: initialEquity, equity: initialEquity};
  validateSettings(settings);
  const maxAge = options.maxHoldingSessions ?? 15;
  if (!Number.isFinite(initialEquity) || initialEquity <= 0 || !Number.isInteger(maxAge) || maxAge < 3 || maxAge > 15) throw new Error('Invalid backtest capital or holding horizon (3–15 sessions).');
  const planner = options.planner ?? buildPlans;
  const series = Object.fromEntries(Object.entries(histories).map(([symbol,rows]) => [symbol, cleanHistory(rows,endDate)]));
  const dates = cleanHistory(index,endDate).filter(b => b.date >= startDate && b.date <= endDate);
  if (dates.length < 2) throw new Error('At least two index sessions are required.');
  const buyFee = settings.buyFeePct / 100, sellFee = settings.sellFeePct / 100, slip = settings.slippagePct / 100;
  let cash = initialEquity, pending: Pending[] = [], positions: Position[] = [], exitSignals = new Set<string>(), skippedEntries = 0, peak = initialEquity, maxDrawdown = 0, tradedValue = 0, exposed = 0;
  const trades: Trade[] = [], equityCurve: BacktestResult['equityCurve'] = [];
  // Fractional IHSG exposure is a theoretical benchmark, not an executable index purchase.
  const benchmarkUnits = initialEquity / (dates[0].open * (1 + slip) * (1 + buyFee));
  const exitPosition = (p: Position, price: number, date: string, reason: string) => {
    const fill = price * (1 - slip), proceeds = p.shares * fill * (1 - sellFee);
    cash += proceeds; tradedValue += p.shares * fill;
    trades.push({symbol:p.symbol,signalDate:p.signalDate,entryDate:p.entryDate,exitDate:date,entry:p.entry,exit:fill,shares:p.shares,netPnl:round(proceeds-p.cost),returnPct:round(100*(proceeds/p.cost-1)),reason,holdingSessions:p.age});
    positions = positions.filter(item => item !== p);
  };
  for (let session = 0; session < dates.length; session++) {
    const date = dates[session].date;
    const bars = Object.fromEntries(Object.entries(series).map(([symbol,rows]) => [symbol,rows.find(b=>b.date===date)]));
    // Do not size with today's close or recycle intraday exit proceeds into an earlier entry.
    const sizingEquity=cash+positions.reduce((n,p)=>n+p.shares*p.mark*(1-slip)*(1-sellFee),0);
    let entryCash=cash, reservedCount=positions.length;
    // Exposure means any position held during the session, including opening exits
    // and positions that both open and close before the daily close.
    let hadExposure=positions.length>0;
    let reservedRisk=positions.reduce((n,p)=>n+Math.max(0,p.shares*(p.mark-Math.min(p.mark,p.stop)*(1-slip)*(1-sellFee))),0);
    // Existing-position exits occur before entries. Locked or absent candles cannot imply a fill.
    for (const p of [...positions]) {
      p.age++;
      const bar = bars[p.symbol]; if (!bar) continue;
      p.mark = bar.close;
      if (locked(bar)) continue;
      if (bar.open <= p.stop) exitPosition(p,bar.open,date,'gap-stop');
      // The open occurs before the intraday low: a marketable standing target
      // must not be turned into a later stop loss by daily-bar ambiguity.
      else if (bar.open >= p.target) exitPosition(p,bar.open,date,'gap-target');
      else if (p.age >= maxAge) exitPosition(p,bar.open,date,'time-exit');
      else if (exitSignals.has(p.symbol)) exitPosition(p,bar.open,date,'signal-exit');
      else if (bar.low <= p.stop) exitPosition(p,p.stop,date,'stop');
      else if (bar.high >= p.target) exitPosition(p,p.target,date,'target');
    }
    for (const {plan,signalDate} of pending) {
      if (plan.action !== 'BUY' || !plan.entry || !plan.stop || !plan.target || !plan.lots) continue;
      const bar = bars[plan.symbol];
      if (!bar || locked(bar) || bar.high < plan.entry || positions.some(p=>p.symbol===plan.symbol) || reservedCount >= settings.maxPositions) {skippedEntries++;continue;}
      const raw = Math.max(bar.open,plan.entry);
      if (raw > plan.entry * 1.03 || raw >= plan.target) {skippedEntries++;continue;}
      const entry = raw * (1 + slip);
      const unitCost = entry*(1+buyFee), unitRisk = unitCost-plan.stop*(1-slip)*(1-sellFee);
      const riskBudget = Math.max(0, Math.min(sizingEquity*settings.riskPct/100, sizingEquity*settings.maxTotalRiskPct/100-reservedRisk));
      const shares = Math.floor(Math.min(plan.lots*100,entryCash/unitCost,sizingEquity*settings.maxPositionPct/100/unitCost,riskBudget/unitRisk)/100)*100;
      if (!Number.isFinite(shares) || shares < 100 || unitRisk <= 0) {skippedEntries++;continue;}
      const p:Position={symbol:plan.symbol,shares,entry,stop:plan.stop,target:plan.target,cost:shares*unitCost,entryDate:date,signalDate,age:1,mark:bar.close};
      cash-=p.cost; entryCash-=p.cost; reservedRisk+=shares*unitRisk;reservedCount++;tradedValue+=shares*entry; positions.push(p);
      hadExposure=true;
      // Daily candles cannot establish whether a low preceded entry. Assume the adverse path.
      if (bar.low <= p.stop) exitPosition(p,p.stop,date,'entry-bar-stop');
      else if (bar.high >= p.target) exitPosition(p,p.target,date,'entry-bar-target');
    }
    if (hadExposure) exposed++;
    // End-of-window positions are marked to liquidation value; no fabricated end-date fill is logged.
    const equity=cash+positions.reduce((n,p)=>n+p.shares*p.mark*(1-slip)*(1-sellFee),0);
    peak=Math.max(peak,equity);maxDrawdown=Math.max(maxDrawdown,100*(peak-equity)/peak);
    const benchmarkEquity=benchmarkUnits*dates[session].close*(1-slip)*(1-sellFee);
    equityCurve.push({date,equity:round(equity),cash:round(cash),benchmarkEquity:round(benchmarkEquity)});
    const visible=Object.fromEntries(Object.entries(series).map(([symbol,rows])=>[symbol,rows.filter(b=>b.date<=date)]));
    const held:Holding[]=positions.map(p=>({symbol:p.symbol,shares:p.shares,entryPrice:p.entry,stop:p.stop,target:p.target,openedDate:p.entryDate}));
    // Pending orders expire after exactly one session. Final-session signals are never executed.
    const plans=session<dates.length-1 ? planner(visible,sorted(index).filter(b=>b.date<=date),held,{...settings,cash,equity},date) : [];
    pending=plans.filter(p=>p.action==='BUY').map(plan=>({plan,signalDate:date}));
    exitSignals=new Set(plans.filter(p=>p.action==='SELL').map(p=>p.symbol));
  }
  const finalEquity=equityCurve.at(-1)!.equity;
  return {startDate:dates[0].date,endDate:dates.at(-1)!.date,initialEquity,finalEquity,totalReturnPct:round(100*(finalEquity/initialEquity-1)),maxDrawdownPct:round(maxDrawdown),tradeCount:trades.length,winRatePct:trades.length?round(100*trades.filter(t=>t.netPnl>0).length/trades.length):0,netProfit:round(finalEquity-initialEquity),expectancy:trades.length?round(trades.reduce((n,t)=>n+t.netPnl,0)/trades.length):0,turnover:round(tradedValue/initialEquity),benchmarkReturnPct:round(100*(equityCurve.at(-1)!.benchmarkEquity/initialEquity-1)),exposurePct:round(100*exposed/dates.length),equityCurve,trades,skippedEntries,openPositions:positions.map(p=>({symbol:p.symbol,shares:p.shares,entry:p.entry,mark:p.mark,unrealizedNetPnl:round(p.shares*p.mark*(1-slip)*(1-sellFee)-p.cost)}))};
}

