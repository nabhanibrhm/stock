import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {runBacktest} from './backtest';
import {STRATEGY_VERSION, defaultSettings} from '../shared/engine';
import {createHash} from 'node:crypto';
import type {Candle} from '../shared/types';

const samples=[...JSON.parse(await readFile('docs/arjum-samples.json','utf8')),...JSON.parse(await readFile('docs/arjum-extra-samples.json','utf8'))];
const universe=['BBCA','BBRI','TLKM','ANTM'];
const histories:Record<string,Candle[]>={};
for(const symbol of [...universe,'IHSG']){
  const item=samples.find((s:any)=>s.status===200 && s.path===`/api/history/${symbol}?limit=500`);
  if(!item?.body?.rows?.length)throw new Error(`Missing validated sample: ${symbol}`);
  histories[symbol]=item.body.rows.map((r:any)=>({date:r.date,open:r.open,high:r.high,low:r.low,close:r.close,volume:r.volume,value:r.value})).sort((a:Candle,b:Candle)=>a.date.localeCompare(b.date));
}
const index=histories.IHSG!;delete histories.IHSG;
const start=60, split=Math.floor(index.length*0.7);
const sensitivity = [
 {name:'Baseline',settings:{}},
 {name:'Double fees',settings:{buyFeePct:0.30,sellFeePct:0.50}},
 {name:'Slippage 0.30%',settings:{slippagePct:0.30}},
 {name:'Double fees + slippage 0.30%',settings:{buyFeePct:0.30,sellFeePct:0.50,slippagePct:0.30}},
].map(scenario=>{
 const result=runBacktest(histories,index,index[split]!.date,index.at(-1)!.date,{settings:scenario.settings});
 return {name:scenario.name,settings:{...defaultSettings,...scenario.settings},returnPct:result.totalReturnPct,maxDrawdownPct:result.maxDrawdownPct,trades:result.tradeCount,expectancy:result.expectancy};
});
const report={
 provenance:{dataSha256:createHash('sha256').update(JSON.stringify({histories,index})).digest('hex'),sampleSessions:index.length,settings:defaultSettings},
 sensitivity,
 generatedAt:new Date().toISOString(),status:'exploratory',strategyVersion:STRATEGY_VERSION,universe,
 warnings:[
  'Exploratory simulation only. Strategy profitability has not been validated.',
  'Fixed current four-symbol sample introduces selection/survivorship bias; historical universe membership is unavailable.',
  'Corporate-action adjustment rules, dividends and historical price limits remain unverified. Sample prices are not independently reconciled.',
  'Development and holdout use fixed preset rules without parameter optimization. This holdout has already been inspected and is no longer a fresh unseen test. A future forward paper period is required.',
  'Missing/locked candles are not filled; holdings are carried at their last available mark. Stale marks can understate drawdown.',
 ],
 assumptions:[
  'Signals use only data available by each close. Entry orders are eligible only next index session and expire afterward.',
  'Stop-entry fills at max(next open, trigger) plus slippage. Gaps above trigger by more than 3% are skipped.',
  'Opening gaps through stop or target execute at the opening price less slippage before intraday range checks. Otherwise stop wins when both stop and target are touched on the same daily bar.',
  'Exposure counts any session with a position held at any point, including same-session round trips.',
  'Position sizing uses prior-session equity. Cash/risk released by same-day exits is reserved until the next session.',
  'Stops and strategy SELL signals can exit before three sessions. The 3–15 session horizon is not a minimum hold. Time exit is session 15 open.',
  'Fee/slippage assumptions: buy 0.15%, sell 0.25%, slippage 0.10%; configurable in engine settings.',
  'Each window starts with Rp10,000,000 cash and no positions. Pre-window candles are indicator warmup only.',
  'Final open positions are marked at estimated net liquidation value, not recorded as executed exits.',
  'Benchmark is fractional theoretical IHSG exposure from first-session open with the same capital, fees and slippage; it is not a tradable instrument.',
 ],
 split:{developmentStart:index[start]!.date,developmentEnd:index[split-1]!.date,holdoutStart:index[split]!.date,holdoutEnd:index.at(-1)!.date},
 development:runBacktest(histories,index,index[start]!.date,index[split-1]!.date),
 holdout:runBacktest(histories,index,index[split]!.date,index.at(-1)!.date),
};
await mkdir('data',{recursive:true});
await writeFile('data/backtest-report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({status:report.status,split:report.split,developmentTrades:report.development.tradeCount,holdoutTrades:report.holdout.tradeCount,output:'data/backtest-report.json'},null,2));


