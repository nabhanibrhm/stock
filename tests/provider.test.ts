import test from 'node:test'
import assert from 'node:assert/strict'
import { validateCandles, validatePortfolio } from '../server/services/validation'
import { defaultSettings } from '../shared/engine'
const rows=Array.from({length:20},(_,i)=>({date:`2026-01-${String(i+1).padStart(2,'0')}`,open:100,high:110,low:90,close:105,volume:1000}))
test('provider rejects duplicates, invalid OHLC and null prices',()=>{
 assert.throws(()=>validateCandles([...rows.slice(0,19),rows[0]]))
 assert.throws(()=>validateCandles(rows.map((r,i)=>i? r:{...r,close:120})))
 assert.throws(()=>validateCandles(rows.map((r,i)=>i? r:{...r,open:null})))
 assert.equal(validateCandles(rows).length,20)
})
test('server rejects invalid portfolio settings and duplicate holdings',()=>{
 assert.throws(()=>validatePortfolio({settings:{...defaultSettings,cash:Infinity},holdings:[]}))
 assert.throws(()=>validatePortfolio({settings:{...defaultSettings,cash:20_000_000},holdings:[]}))
 assert.throws(()=>validatePortfolio({settings:defaultSettings,holdings:[{symbol:'BBCA',shares:100,entryPrice:5000},{symbol:'BBCA',shares:100,entryPrice:5000}]}))
 assert.throws(()=>validatePortfolio({settings:defaultSettings,holdings:[{symbol:'UNKNOWN',shares:100,entryPrice:5000}]}))
 assert.deepEqual(validatePortfolio({settings:defaultSettings,holdings:[]}).holdings,[])
})

test('zero cash and equity are valid while negative equity remains invalid',()=>{
 const zero=validatePortfolio({settings:{...defaultSettings,cash:0,equity:0},holdings:[]})
 assert.equal(zero.settings.cash,0)
 assert.equal(zero.settings.equity,0)
 assert.throws(()=>validatePortfolio({settings:{...defaultSettings,cash:0,equity:-1},holdings:[]}))
 assert.throws(()=>validatePortfolio({settings:{...defaultSettings,cash:1,equity:0},holdings:[]}))
})

test('holding target survives validation and rejects negative targets',()=>{
 const h={symbol:'BBCA',shares:100,entryPrice:5000,stop:4500,target:6000}
 assert.equal(validatePortfolio({settings:defaultSettings,holdings:[h]}).holdings[0]?.target,6000)
 assert.throws(()=>validatePortfolio({settings:defaultSettings,holdings:[{...h,target:-1}]}))
})

test('Rp300000 capital is valid and errors identify the failing setting',()=>{
 assert.equal(validatePortfolio({settings:{...defaultSettings,cash:300000,equity:300000},holdings:[]}).settings.cash,300000)
 assert.throws(()=>validatePortfolio({settings:{...defaultSettings,cash:300000,equity:0},holdings:[]}),/Total ekuitas portofolio/)
 assert.throws(()=>validatePortfolio({settings:{...defaultSettings,riskPct:6},holdings:[]}),/Risiko \/ trade/)
 assert.throws(()=>validatePortfolio({settings:{...defaultSettings,maxPositions:0},holdings:[]}),/Maksimal posisi/)
})
