import test from 'node:test'
import assert from 'node:assert/strict'
import {assessHistoryEligibility,assessUniverse,buildPlans,cleanHistory,defaultSettings,evaluateSetup,rankSetup,roundPrice,sizePosition,STRATEGY_VERSION} from '../shared/engine'
import type {Candle,Settings} from '../shared/types'
function candles(): Candle[]{
 const result:Candle[]=[]; const d=new Date('2025-01-01T00:00:00Z')
 while(result.length<80){if(d.getUTCDay()!==0&&d.getUTCDay()!==6){const close=1000+result.length*5;result.push({date:d.toISOString().slice(0,10),open:close-2,high:close+3,low:close-5,close,volume:2_000_000,value:close*2_000_000})}d.setUTCDate(d.getUTCDate()+1)}
 result.at(-1)!.close+=30;result.at(-1)!.high=result.at(-1)!.close+5
 return result
}
const rows=candles(),date=rows.at(-1)!.date
const settings:Settings={...defaultSettings,minDailyValue:0}
test('known breakout is a next-session trigger, never a fill at the signal close',()=>{
 const s=evaluateSetup(rows,rows,date);assert.equal(s.action,'BUY');assert.equal(s.setup,'breakout');assert.ok(s.entry!>rows.at(-1)!.high);assert.ok(s.stop!<s.entry!);assert.ok(s.target!>s.entry!)
})
test('future data cannot affect a signal',()=>{
 const future={...rows.at(-1)!,date:'2099-01-01',close:900000,high:900001,low:899999,open:900000}
 assert.deepEqual(evaluateSetup([...rows,future],rows,date),evaluateSetup(rows,rows,date))
})
test('stale, insufficient, missing sessions and invalid candles block entries',()=>{
 assert.equal(evaluateSetup(rows.slice(0,-1),rows,date).action,'WAIT')
 assert.equal(evaluateSetup(rows.slice(-20),rows,date).action,'WAIT')
 assert.equal(evaluateSetup(rows.filter((_,i)=>i!==50),rows,date).action,'WAIT')
 assert.equal(evaluateSetup([...rows,{...rows.at(-1)!}],rows,date).action,'WAIT')
 assert.equal(evaluateSetup(rows.map((r,i)=>i===79?{...r,high:r.low-1}:r),rows,date).action,'WAIT')
 assert.throws(()=>cleanHistory([{...rows[0]!,close:NaN}],date))
})
test('position sizing includes both fees and slippage and never spends more than cash',()=>{
 const s=sizePosition(1000,950,1_000_000,settings,200_000,50_000)
 assert.equal(s.lots,1);assert.ok(s.estimatedCost>100_000);assert.ok(s.plannedRisk>5000);assert.ok(s.estimatedCost<=200_000)
 assert.equal(sizePosition(1000,1000,1_000_000,settings).lots,0)
 assert.equal(sizePosition(1000,950,1_000_000,settings,10,50_000).lots,0)
 assert.equal(sizePosition(1000,950,1,settings).lots,0)
})
test('aggregate cash and risk are reserved across competing candidates',()=>{
 const tight={...settings,maxPositionPct:90,riskPct:1,maxTotalRiskPct:1,cash:1_000_000,equity:1_000_000}
 const plans=buildPlans({BBBB:rows,AAAA:rows,CCCC:rows},rows,[],tight,date)
 assert.ok(plans.reduce((sum,p)=>sum+p.estimatedCost,0)<=tight.cash)
 assert.ok(plans.reduce((sum,p)=>sum+p.plannedRisk,0)<=tight.equity*tight.maxTotalRiskPct/100+0.01)
 assert.equal(plans[0]!.symbol,'AAAA')
})
test('existing holdings without stops reserve full position risk and block new buys',()=>{
 const plans=buildPlans({AAAA:rows,BBBB:rows},rows,[{symbol:'AAAA',shares:1000,entryPrice:1000}],settings,date)
 assert.equal(plans.find(p=>p.symbol==='BBBB')!.action,'WAIT')
})
test('SELL requires ownership, missing holdings data blocks exit, stop triggers sell',()=>{
 assert.ok(buildPlans({AAAA:rows},rows,[],settings,date).every(p=>p.action!=='SELL'))
 const h={symbol:'AAAA',shares:100,entryPrice:1500,stop:1500}
 assert.equal(buildPlans({AAAA:rows},rows,[h],settings,date)[0]!.action,'SELL')
 assert.equal(buildPlans({},rows,[h],settings,date)[0]!.action,'HOLD')
})
test('15-session time exit and max position cap are enforced',()=>{
 const h={symbol:'AAAA',shares:100,entryPrice:1000,stop:1300,openedDate:rows[60]!.date}
 const plans=buildPlans({AAAA:rows,BBBB:rows},rows,[h],{...settings,maxPositions:1},date)
 assert.equal(plans[0]!.action,'SELL');assert.equal(plans[1]!.action,'WAIT')
})
test('invalid settings and duplicate holdings fail explicitly',()=>{
 assert.throws(()=>buildPlans({AAAA:rows},rows,[],{...settings,cash:-1},date))
 const h={symbol:'AAAA',shares:100,entryPrice:1000}
 assert.throws(()=>buildPlans({AAAA:rows},rows,[h,h],settings,date))
})
test('price grids round correctly across IDX bands',()=>{
 assert.equal(roundPrice(199.5,'up'),200);assert.equal(roundPrice(499,'up'),500);assert.equal(roundPrice(1999,'up'),2000);assert.equal(roundPrice(4999,'up'),5000)
 assert.equal(roundPrice(501,'down'),500);assert.equal(roundPrice(5001,'up'),5025)
})
test('held exits are blocked when recent sessions or market data are missing, or latest volume is zero',()=>{
 const h={symbol:'AAAA',shares:100,entryPrice:1500,stop:1500}
 const missing=rows.filter((_,i)=>i!==50)
 assert.equal(buildPlans({AAAA:missing},rows,[h],settings,date)[0]!.action,'HOLD')
 const zero=rows.map((r,i)=>i===79?{...r,volume:0}:r)
 assert.equal(buildPlans({AAAA:zero},rows,[h],settings,date)[0]!.action,'HOLD')
 assert.equal(buildPlans({AAAA:rows},[],[h],settings,date)[0]!.action,'HOLD')
})
test('time exit is planned after 14 inclusive held sessions for the fifteenth open',()=>{
 const base={symbol:'AAAA',shares:100,entryPrice:1000,stop:1000}
 const day13=buildPlans({AAAA:rows},rows,[{...base,openedDate:rows[67]!.date}],settings,date)[0]!
 const day14=buildPlans({AAAA:rows},rows,[{...base,openedDate:rows[66]!.date}],settings,date)[0]!
 assert.equal(day13.action,'HOLD')
 assert.equal(day14.action,'SELL')
 assert.ok(day14.reasons.some(r=>r.includes('pembukaan sesi ke-15')))
 const future={...rows.at(-1)!,date:'2099-01-01'}
 assert.deepEqual(buildPlans({AAAA:[...rows,future]},rows,[{...base,openedDate:rows[67]!.date}],settings,date)[0],day13)
})
test('zero cash and equity supports an empty portfolio without creating buy allocations',()=>{
 const zero={...settings,cash:0,equity:0}
 assert.deepEqual(buildPlans({},rows,[],zero,date),[])
 const plans=buildPlans({AAAA:rows},rows,[],zero,date)
 assert.equal(plans[0]!.action,'WAIT')
 assert.equal(plans[0]!.lots,0)
 assert.equal(plans[0]!.estimatedCost,0)
 assert.equal(plans[0]!.plannedRisk,0)
 assert.deepEqual(sizePosition(1000,950,1_000_000,zero),{lots:0,estimatedCost:0,plannedRisk:0})
})
test('zero-equity holdings remain reviewable while new buys stay blocked',()=>{
 const zero={...settings,cash:0,equity:0}
 const held={symbol:'AAAA',shares:100,entryPrice:1500,stop:1500}
 const plans=buildPlans({AAAA:rows,BBBB:rows},rows,[held],zero,date)
 assert.equal(plans.find(p=>p.symbol==='AAAA')!.action,'SELL')
 const candidate=plans.find(p=>p.symbol==='BBBB')!
 assert.equal(candidate.action,'WAIT')
 assert.equal(candidate.lots,0)
 assert.equal(candidate.estimatedCost,0)
 assert.equal(candidate.plannedRisk,0)
})
test('zero balances do not permit negative equity or cash above equity',()=>{
 assert.throws(()=>buildPlans({},rows,[],{...settings,cash:0,equity:-1},date))
 assert.throws(()=>buildPlans({},rows,[],{...settings,cash:-1,equity:0},date))
 assert.throws(()=>buildPlans({},rows,[],{...settings,cash:1,equity:0},date))
})
test('held target touches create a review exit and preserve the supplied target',()=>{
 const h={symbol:'AAAA',shares:100,entryPrice:1000,stop:1000,target:1425}
 const plan=buildPlans({AAAA:rows},rows,[h],settings,date)[0]!
 assert.equal(plan.target,1425)
 assert.equal(plan.action,'SELL')
 assert.ok(plan.reasons.some(r=>r.includes('fill belum terkonfirmasi')))
 const stale=buildPlans({AAAA:rows.slice(0,-1)},rows,[h],settings,date)[0]!
 assert.equal(stale.target,1425)
 assert.equal(stale.action,'HOLD')
})
test('same-session stop and target touches prioritize stop review without claiming a fill',()=>{
 const h={symbol:'AAAA',shares:100,entryPrice:1400,stop:1400,target:1425}
 const plan=buildPlans({AAAA:rows},rows,[h],settings,date)[0]!
 assert.equal(plan.action,'SELL')
 assert.ok(plan.reasons[0]!.includes('stop posisi'))
 assert.ok(plan.reasons.some(r=>r.includes('urutan intraday tidak diketahui')))
})
test('missing targets are disclosed and invalid targets are rejected',()=>{
 const h={symbol:'AAAA',shares:100,entryPrice:1000,stop:1000}
 const plan=buildPlans({AAAA:rows},rows,[h],settings,date)[0]!
 assert.equal(plan.target,null)
 assert.ok(plan.reasons.some(r=>r.includes('exit target tidak dipantau')))
 for(const target of [0,-1,NaN,Infinity])assert.throws(()=>buildPlans({AAAA:rows},rows,[{...h,target}],settings,date))
})
test('higher-ranked qualifying setup receives scarce position capacity before alphabetically earlier symbols',()=>{
 const strong=rows.map((r,i)=>i===rows.length-1?{...r,volume:r.volume*3,value:r.value!*3}:r)
 const plans=buildPlans({AAAA:rows,ZZZZ:strong},rows,[],{...settings,maxPositions:1},date)
 assert.equal(plans[0]!.symbol,'ZZZZ')
 assert.equal(plans[0]!.action,'BUY')
 assert.equal(plans[0]!.rank,1)
 assert.equal(plans[1]!.symbol,'AAAA')
 assert.equal(plans[1]!.action,'WAIT')
 assert.equal(plans[1]!.rank,2)
 assert.ok(plans[0]!.score!>plans[1]!.score!)
 assert.ok(plans[0]!.rankingReasons!.some(r=>r.includes('bukan probabilitas')))
 assert.equal(plans[0]!.strategyVersion,'swing-eod-1.1.0')
})
test('equal scores tie by symbol independently of input insertion order',()=>{
 const plans=buildPlans({ZZZZ:rows,AAAA:rows},rows,[],{...settings,maxPositions:1},date)
 assert.equal(plans[0]!.symbol,'AAAA')
 assert.equal(plans[0]!.action,'BUY')
 assert.equal(plans[1]!.rank,2)
 assert.equal(plans[0]!.score,plans[1]!.score)
})
test('history and liquidity eligibility are diagnosed independently of bearish IHSG setup filter',()=>{
 const bearish=rows.map((r,i)=>{const close=2000-i*5;return {...r,open:close,close,high:close+5,low:close-5}})
 const illiquid=rows.map(r=>({...r,volume:100,value:100*r.close}))
 const universe=assessUniverse({GOOD:rows,THIN:illiquid,SHORT:rows.slice(-30)},bearish,{minDailyValue:1_000_000_000},date)
 assert.equal(universe.GOOD!.eligible,true)
 assert.equal(universe.THIN!.eligible,false)
 assert.ok(universe.THIN!.reasonCodes.includes('illiquid'))
 assert.equal(universe.SHORT!.historySessions,30)
 assert.ok(universe.SHORT!.reasonCodes.includes('insufficient_history'))
 const plans=buildPlans({GOOD:rows,THIN:illiquid,SHORT:rows.slice(-30)},bearish,[],defaultSettings,date)
 assert.ok(plans.every(p=>p.action==='WAIT'))
 assert.equal(plans.find(p=>p.symbol==='GOOD')!.eligible,true)
 assert.equal(plans.find(p=>p.symbol==='GOOD')!.rank,null)
 assert.ok(plans.find(p=>p.symbol==='THIN')!.reasons.some(r=>r.includes('Likuiditas')))
 assert.ok(plans.find(p=>p.symbol==='SHORT')!.reasons.some(r=>r.includes('30/60')))
})
test('eligibility rejects stale, invalid, missing-session and zero-volume data with explicit codes',()=>{
 assert.ok(assessHistoryEligibility(rows.slice(0,-1),rows,0,date).reasonCodes.includes('stale_history'))
 assert.ok(assessHistoryEligibility([...rows,rows.at(-1)!],rows,0,date).reasonCodes.includes('invalid_history'))
 assert.ok(assessHistoryEligibility(rows.filter((_,i)=>i!==50),rows,0,date).reasonCodes.includes('missing_sessions'))
 assert.ok(assessHistoryEligibility(rows.map((r,i)=>i===79?{...r,volume:0}:r),rows,0,date).reasonCodes.includes('no_volume'))
 assert.ok(assessHistoryEligibility(rows,[],0,date).reasonCodes.includes('insufficient_index'))
 assert.throws(()=>assessHistoryEligibility(rows,rows,-1,date))
})
test('eligibility metrics and ranking use only observations available on the specified date',()=>{
 const future={...rows.at(-1)!,date:'2099-01-01',volume:9e12,value:9e15}
 assert.deepEqual(assessHistoryEligibility([...rows,future],[...rows,future],0,date),assessHistoryEligibility(rows,rows,0,date))
 assert.deepEqual(rankSetup([...rows,future],[...rows,future],date),rankSetup(rows,rows,date))
 const a=buildPlans({AAAA:rows},rows,[],settings,date)
 const b=buildPlans({AAAA:[...rows,future]},[...rows,future],[],settings,date)
 assert.deepEqual(a,b)
 assert.equal(a[0]!.historySessions,80)
 const estimated=assessHistoryEligibility(rows.map(({value,...r})=>r),rows,0,date)
 assert.equal(estimated.valueEstimated,true)
 assert.ok(estimated.avgDailyValue!>0)
 assert.equal(STRATEGY_VERSION,'swing-eod-1.1.0')
})
test('a newly recorded fill after the last completed session waits for its own session data',()=>{
 const h={symbol:'AAAA',shares:100,entryPrice:1000,stop:990,openedDate:'2099-01-01'}
 const plan=buildPlans({AAAA:rows},rows,[h],settings,date)[0]!
 assert.equal(plan.action,'WAIT')
 assert.ok(plan.reasons.some(r=>r.includes('setelah sesi data terakhir')))
})
