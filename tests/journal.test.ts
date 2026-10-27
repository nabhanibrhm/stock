import test from 'node:test'
import assert from 'node:assert/strict'
import { defaultSettings } from '../shared/engine'
import { applyTrade, validateTrade, mergeExitAlerts, monitorPositions, type Portfolio, type TradeInput } from '../shared/journal'
import type { TradePlan } from '../shared/types'
import {holdingSchedule} from '../shared/calendar'

const buy:TradeInput={id:'buy-test-001',symbol:'BBCA',side:'BUY',date:'2026-10-20',shares:200,price:1000,fee:300,stop:950,target:1100}
const portfolio:Portfolio={settings:{...defaultSettings,cash:1000000,equity:1000000},holdings:[]}
test('actual fills account for fees and weighted basis across partial exits; duplicate submissions do not double book',()=>{
 const first=applyTrade(portfolio,{trades:[],basis:{}},buy,{BBCA:1000},'now')
 assert.equal(first.portfolio.settings.cash,799700)
 assert.equal(first.portfolio.settings.equity,999700)
 const repeated=applyTrade(first.portfolio,first.state,buy,{BBCA:1000},'later')
 assert.equal(repeated.duplicate,true);assert.equal(repeated.state.trades.length,1)
 const exit={...buy,id:'sell-test-001',side:'SELL' as const,date:'2026-10-21',shares:100,price:1100,fee:275}
 const second=applyTrade(first.portfolio,first.state,exit,{BBCA:1100},'later')
 assert.equal(second.portfolio.holdings[0]!.shares,100)
 assert.equal(second.portfolio.settings.cash,909425)
 assert.equal(second.state.trades.at(-1)!.realizedPnl,9575)
 assert.equal(second.state.basis.BBCA!.cost,100150)
 assert.throws(()=>applyTrade(second.portfolio,second.state,{...exit,id:'sell-test-002',shares:200},{},'later'),/melebihi/)
 assert.throws(()=>applyTrade(first.portfolio,first.state,{...buy,price:1005},{},'later'),/berbeda/)
})
test('new buys average costs while imported position fee basis stays explicitly unknown',()=>{
 const first=applyTrade(portfolio,{trades:[],basis:{}},buy,{},'now')
 const second=applyTrade(first.portfolio,first.state,{...buy,id:'buy-test-002',shares:100,price:1200,fee:180},{},'now')
 assert.equal(second.portfolio.holdings[0]!.entryPrice,320000/300)
 assert.equal(second.state.basis.BBCA!.cost,320480)
 const imported={...portfolio,holdings:[{symbol:'BBCA',shares:200,entryPrice:1000}]}
 const sold=applyTrade(imported,{trades:[],basis:{}},{...buy,id:'sell-import',side:'SELL',shares:100,price:1100,fee:275},{},'now')
 assert.equal(sold.state.trades[0]!.realizedPnl,null)
 assert.equal(sold.state.trades[0]!.basisKnown,false)
})
test('reject invalid dates, quantities, cash shortage and out-of-order trades',()=>{
 assert.throws(()=>validateTrade({...buy,date:'2026-02-30'},['BBCA'],'2026-10-26'),/Tanggal/)
 assert.throws(()=>validateTrade({...buy,fee:-1},['BBCA'],'2026-10-26'),/biaya/)
 assert.throws(()=>applyTrade(portfolio,{trades:[],basis:{}},{...buy,shares:1100},{},'now'),/Dana/)
 assert.throws(()=>applyTrade(portfolio,{trades:[],basis:{}},{...buy,shares:101},{},'now'),/100/)
 const first=applyTrade(portfolio,{trades:[],basis:{}},buy,{},'now')
 assert.throws(()=>applyTrade(first.portfolio,first.state,{...buy,id:'buy-test-003',date:'2026-10-19'},{},'now'),/berurutan/)
})
test('monitoring blocks stale data and deduplicates acknowledged same-session exit alerts',()=>{
 const holding={symbol:'BBCA',shares:200,entryPrice:1000,stop:950}
 const plan:TradePlan={symbol:'BBCA',action:'SELL',reasons:['Stop tersentuh'],entry:1000,stop:950,target:null,lots:2,estimatedCost:0,plannedRisk:0,asOf:'2026-10-26',expiry:'NEXT_TRADING_SESSION_ONLY',strategyVersion:'test'}
 const histories={BBCA:[{date:'2026-10-26',open:1000,high:1010,low:940,close:960,volume:1000}]}
 const fresh=monitorPositions([holding],[plan],histories,defaultSettings,'2026-10-26')
 assert.equal(fresh[0]!.action,'SELL');assert.equal(fresh[0]!.estimatedNet,191328.48)
 const alerts=mergeExitAlerts([],fresh,'now');alerts[0]!.acknowledgedAt='now'
 assert.equal(mergeExitAlerts(alerts,fresh,'later').length,1)
 const stale=monitorPositions([holding],[plan],histories,defaultSettings,'2026-10-27')
 assert.equal(stale[0]!.action,'WAIT');assert.equal(stale[0]!.estimatedNet,null)
 assert.equal(mergeExitAlerts([],stale,'later').length,0)
 const blocked=monitorPositions([holding],[{...plan,reasons:['Sesi posisi/IHSG tidak lengkap; keputusan jual diblokir']}],histories,defaultSettings,'2026-10-26')
 assert.equal(blocked[0]!.actionable,false)
})

test('new fills freeze the chosen horizon; adds and partial sales preserve the original schedule',()=>{
 const first=applyTrade({...portfolio,settings:{...portfolio.settings,holdingSessions:3}},{trades:[],basis:{}},{...buy,holdingSessions:10},{},'now')
 const original=first.portfolio.holdings[0]!
 assert.equal(original.holdingSessions,10)
 assert.equal(original.openedDate,buy.date)
 const changed={...first.portfolio,settings:{...first.portfolio.settings,holdingSessions:5}}
 const add=applyTrade(changed,first.state,{...buy,id:'buy-horizon-add',date:'2026-10-21',holdingSessions:3},{},'now')
 const sold=applyTrade(add.portfolio,add.state,{...buy,id:'sell-horizon-partial',side:'SELL',date:'2026-10-22',shares:100,holdingSessions:15},{},'now')
 for(const h of [add.portfolio.holdings[0]!,sold.portfolio.holdings[0]!]){
  assert.equal(h.holdingSessions,10);assert.equal(h.openedDate,buy.date)
  assert.deepEqual(holdingSchedule(h.openedDate,h.holdingSessions!,'2026-10-26'),holdingSchedule(original.openedDate,10,'2026-10-26'))
 }
 assert.throws(()=>applyTrade(first.portfolio,first.state,{...buy,holdingSessions:5},{},'now'),/berbeda/)
})

test('missing horizons on imported holdings remain legacy fifteen sessions after an add',()=>{
 const imported={...portfolio,settings:{...portfolio.settings,holdingSessions:3},holdings:[{symbol:'BBCA',shares:100,entryPrice:1000,openedDate:'2026-10-19'}]}
 const added=applyTrade(imported,{trades:[],basis:{}},{...buy,holdingSessions:5},{},'now')
 assert.equal(added.portfolio.holdings[0]!.holdingSessions,15)
 assert.equal(added.portfolio.holdings[0]!.openedDate,'2026-10-19')
 const fresh=applyTrade({...portfolio,settings:{...portfolio.settings,holdingSessions:5}},{trades:[],basis:{}},buy,{},'now')
 assert.equal(fresh.portfolio.holdings[0]!.holdingSessions,5)
})

test('fill validation rejects known non-sessions and invalid horizons without blocking historical actual records',()=>{
 for(const date of ['2026-08-17','2026-10-24'])assert.throws(()=>validateTrade({...buy,date},['BBCA'],'2026-10-26'),/sesi bursa/)
 for(const holdingSessions of [2,16,3.5,'10',NaN])assert.throws(()=>validateTrade({...buy,holdingSessions},['BBCA'],'2026-10-26'),/pegang/)
 assert.equal(validateTrade({...buy,date:'2025-10-20'},['BBCA'],'2026-10-26').date,'2025-10-20')
})
