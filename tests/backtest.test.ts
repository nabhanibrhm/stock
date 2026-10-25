import test from 'node:test';
import assert from 'node:assert/strict';
import {runBacktest} from '../analytics/backtest';
import type {Candle,TradePlan} from '../shared/types';

const candle=(date:string,open=1000,high=1050,low=990,close=1020):Candle=>({date,open,high,low,close,volume:1_000_000,value:1_000_000_000});
const plan={symbol:'TEST',action:'BUY',entry:1000,stop:950,target:1100,lots:10,reasons:[],asOf:'2025-01-01',expiry:'next-session',strategyVersion:'test'} as unknown as TradePlan;
const options={settings:{buyFeePct:0,sellFeePct:0,slippagePct:0,minDailyValue:0,riskPct:10,maxPositionPct:99,maxTotalRiskPct:20},planner:()=>[plan]};
test('signal uses close only; entry begins next day and adverse same-bar exit wins',()=>{
 const bars=[candle('2025-01-01'),candle('2025-01-02',1000,1150,900,1050),candle('2025-01-03')];
 const seen:string[]=[];
 const r=runBacktest({TEST:bars},bars,bars[0]!.date,bars[2]!.date,{...options,planner:(h,i,holds,s,date)=>{assert.ok(h.TEST!.every(b=>b.date<=date));assert.ok(i.every(b=>b.date<=date));seen.push(date);return seen.length===1?[plan]:[];}});
 assert.equal(r.trades.length,1);assert.equal(r.trades[0]!.entryDate,'2025-01-02');assert.equal(r.trades[0]!.exit,950);assert.equal(r.trades[0]!.reason,'entry-bar-stop');
});
test('gap below stop realizes opening loss rather than planned stop',()=>{
 const bars=[candle('2025-01-01'),candle('2025-01-02'),candle('2025-01-03',900,940,880,910)];
 let n=0;const r=runBacktest({TEST:bars},bars,bars[0]!.date,bars[2]!.date,{...options,planner:()=>++n===1?[plan]:[]});
 assert.equal(r.trades[0]!.exit,900);assert.equal(r.trades[0]!.reason,'gap-stop');
});
test('untriggered orders expire and gaps above 3 percent do not chase',()=>{
 const bars=[candle('2025-01-01'),candle('2025-01-02',900,980,890,950),candle('2025-01-03',1040,1200,1030,1100)];
 let n=0;const r=runBacktest({TEST:bars},bars,bars[0]!.date,bars[2]!.date,{...options,planner:()=>++n===1?[plan]:[]});
 assert.equal(r.tradeCount,0);assert.equal(r.finalEquity,10_000_000);assert.equal(r.skippedEntries,1);
 const gap=runBacktest({TEST:bars},bars,bars[0]!.date,bars[2]!.date,options);
 assert.equal(gap.tradeCount,0);assert.equal(gap.skippedEntries,2);
});
test('locked candles cannot fabricate fills; no negative cash under competing trades',()=>{
 const bars=[candle('2025-01-01'),candle('2025-01-02',1000,1000,1000,1000),candle('2025-01-03')];
 const r=runBacktest({TEST:bars},bars,bars[0]!.date,bars[2]!.date,{...options,initialEquity:50_000});
 assert.equal(r.tradeCount,0);assert.ok(r.equityCurve.every(p=>p.cash>=0));
});
test('fees reduce outcome and benchmark uses same starting cash',()=>{
 const bars=[candle('2025-01-01'),candle('2025-01-02',1000,1150,990,1100),candle('2025-01-03')];
 let n=0;const r=runBacktest({TEST:bars},bars,bars[0]!.date,bars[2]!.date,{...options,settings:{...options.settings,buyFeePct:1,sellFeePct:1},planner:()=>++n===1?[plan]:[]});
 assert.ok(r.trades[0]!.netPnl<100_000);assert.ok(r.equityCurve[0]!.benchmarkEquity<10_200_000);
});
test('time exit at session 3 open precedes that day intraday target',()=>{
 const bars=[candle('2025-01-01'),candle('2025-01-02'),candle('2025-01-03'),candle('2025-01-04',1020,1150,1000,1100)];
 let n=0;const r=runBacktest({TEST:bars},bars,bars[0]!.date,bars[3]!.date,{...options,maxHoldingSessions:3,planner:()=>++n===1?[plan]:[]});
 assert.equal(r.trades[0]!.exit,1020);assert.equal(r.trades[0]!.reason,'time-exit');assert.equal(r.trades[0]!.holdingSessions,3);
});
test('simultaneous entries respect shared available cash',()=>{
 const bars=[candle('2025-01-01'),candle('2025-01-02'),candle('2025-01-03')];
 let n=0;const r=runBacktest({TEST:bars,OTHER:bars},bars,bars[0]!.date,bars[2]!.date,{...options,initialEquity:1_000_000,planner:()=>++n===1?[plan,{...plan,symbol:'OTHER'}]:[]});
 assert.ok(r.equityCurve.every(p=>p.cash>=0));assert.equal(r.equityCurve[1]!.cash,0);
});
test('strategy SELL can exit before three sessions',()=>{
 const bars=[candle('2025-01-01'),candle('2025-01-02'),candle('2025-01-03')];
 let n=0;const r=runBacktest({TEST:bars},bars,bars[0]!.date,bars[2]!.date,{...options,planner:()=>++n===1?[plan]:[{...plan,action:'SELL'}]});
 assert.equal(r.trades[0]!.reason,'signal-exit');assert.equal(r.trades[0]!.holdingSessions,2);
});
test('same-day exit proceeds cannot fund an entry whose intraday ordering is unknown',()=>{
 const bars=[candle('2025-01-01'),candle('2025-01-02'),candle('2025-01-03',1000,1150,990,1100),candle('2025-01-04')];
 let n=0;const r=runBacktest({TEST:bars,OTHER:bars},bars,bars[0]!.date,bars[3]!.date,{...options,initialEquity:1_000_000,planner:()=>{n++;return n===1?[plan]:n===2?[{...plan,symbol:'OTHER'}]:[];}});
 // Prior TEST position used Rp900,000. Only the remaining Rp100,000 can fund OTHER,
 // even though TEST's target is touched somewhere on the same daily candle.
 const other=r.trades.find(t=>t.symbol==='OTHER');
 assert.ok(other);assert.equal(other.shares,100);
});

test('opening gap above a standing target exits before a later intraday stop',()=>{
 const bars=[candle('2025-01-01'),candle('2025-01-02'),candle('2025-01-03',1120,1150,900,1000)];
 let n=0;const r=runBacktest({TEST:bars},bars,bars[0]!.date,bars[2]!.date,{...options,planner:()=>++n===1?[plan]:[]});
 assert.equal(r.trades[0]!.reason,'gap-target');
 assert.equal(r.trades[0]!.exit,1120);
 assert.equal(r.trades[0]!.netPnl,120_000);
});

test('opening target gap has explicit precedence over a coincident scheduled exit',()=>{
 const bars=[candle('2025-01-01'),candle('2025-01-02'),candle('2025-01-03'),candle('2025-01-04',1120,1150,900,1000)];
 let n=0;const r=runBacktest({TEST:bars},bars,bars[0]!.date,bars[3]!.date,{...options,maxHoldingSessions:3,planner:()=>++n===1?[plan]:[]});
 assert.equal(r.trades[0]!.reason,'gap-target');
 assert.equal(r.trades[0]!.exit,1120);
 assert.equal(r.trades[0]!.holdingSessions,3);
});

test('exposure includes same-session round trips and sessions with opening exits',()=>{
 const bars=[candle('2025-01-01'),candle('2025-01-02',1000,1150,990,1100),candle('2025-01-03')];
 let n=0;const intraday=runBacktest({TEST:bars},bars,bars[0]!.date,bars[2]!.date,{...options,planner:()=>++n===1?[plan]:[]});
 assert.equal(intraday.tradeCount,1);
 assert.equal(intraday.openPositions.length,0);
 assert.equal(intraday.exposurePct,33.33);
 const gapBars=[candle('2025-01-01'),candle('2025-01-02'),candle('2025-01-03',900,940,880,910)];
 n=0;const overnight=runBacktest({TEST:gapBars},gapBars,gapBars[0]!.date,gapBars[2]!.date,{...options,planner:()=>++n===1?[plan]:[]});
 assert.equal(overnight.exposurePct,66.67);
});

