import test from 'node:test'
import assert from 'node:assert/strict'
import {brokerContext,financialContext,providerAnalysis} from '../shared/research'
const expected='2026-10-26'
const broker=(flow:string,day=expected)=>({stock_code:'BBCA',flow,broker_start_date:day,broker_end_date:day,broker_net:false,brokers:[{broker_code:'BK',bval:100,sval:150,nval:-50}]})
const accumulation={code:'BBCA',start_date:'2026-10-23',end_date:expected,series:[{broker_code:'BK',points:[{date:expected,nval:-50,cum_nval:9999},{date:'2026-10-23',nval:20}]}]}
const report=(type:string,data:any)=>({stock_code:'BBCA',report_type:type,period:'quarterly',items:[{year:'2026',quarter:'2',data}]})
test('provider analysis preserves text with actual header observation date, never fetch date',()=>{
 const output='📊 **ANTM** — Analisis Senin, 26 Okt 2026\nProvider recommendation'
 const r=providerAnalysis('ANTM',{stock_code:'ANTM',output},expected)
 assert.equal(r.status,'available');assert.equal(r.asOf,expected);assert.equal(r.output,output)
 assert.equal(providerAnalysis('ANTM',{stock_code:'ANTM',output:output.replace('26 Okt','23 Okt')},expected).status,'stale')
 const unknown=providerAnalysis('ANTM',{stock_code:'ANTM',output:'Undated analysis'},expected)
 assert.equal(unknown.status,'partial');assert.equal(unknown.asOf,null)
})
test('provider analysis rejects wrong symbols, future/invalid dates, malformed and oversized output',()=>{
 for(const body of [{stock_code:'BBCA',output:'test'},{stock_code:'ANTM',output:'**BBCA** — Analisis Senin, 26 Okt 2026'},{stock_code:'ANTM',output:'**ANTM** — Analisis Selasa, 27 Okt 2026'},{stock_code:'ANTM',output:'**ANTM** — Analisis Senin, 31 Feb 2026'},{stock_code:'ANTM',output:123},{stock_code:'ANTM',output:'x'.repeat(30001)}]){
  const r=providerAnalysis('ANTM',body,expected);assert.equal(r.status,'unavailable');assert.equal(r.output,'')
 }
})
test('broker context uses signed rows and daily sums, never truncated broker totals',()=>{
 const r=brokerContext('BBCA',broker('F'),broker('D'),accumulation,expected)
 assert.equal(r.status,'available');assert.equal(r.asOf,expected)
 assert.match(r.items[0]!.value,/jual bersih/);assert.match(r.items[2]!.value,/30/);assert.ok(!r.items[2]!.value.includes('9999'))
 assert.match(r.notes[0]!,/bukan total/)
})
test('missing, malformed and stale broker data remains explicit',()=>{
 assert.equal(brokerContext('BBCA',broker('F','2026-10-23'),null,null,expected).status,'stale')
 assert.equal(brokerContext('BBCA',broker('D'),null,null,expected).status,'unavailable')
 const invalid=broker('F');invalid.brokers[0]!.nval=999
 assert.equal(brokerContext('BBCA',invalid,null,null,expected).status,'unavailable')
 assert.equal(brokerContext('BBCA',broker('F','2026-10-27'),null,null,expected).status,'unavailable')
})
test('bank cashflow is contextual, no blanket debt or negative-cashflow health conclusion',()=>{
 const r=financialContext('BBCA',report('INCOME_STATEMENT',{laba_rugi:10}),report('BALANCE_SHEET',{liabilitas:{liabilitas:100,simpanan_nasabah:80},ekuitas:{ekuitas:20}}),report('CASH_FLOW_REPORT',{arus_kas_bersih_yang_diperoleh_dari_digunakan_untuk_aktivitas_operasi:-5}),expected)
 assert.equal(r.status,'partial');assert.equal(r.asOf,'2026-06-30');assert.equal(r.items[2]!.tone,'neutral');assert.match(r.items[3]!.value,/bank/)
 assert.ok(r.notes.some(n=>n.includes('bukan tanggal publikasi')))
})
test('unknown financial schemas do not invent metrics; future periods excluded',()=>{
 const future=report('INCOME_STATEMENT',{laba_rugi:2});future.items[0]!.quarter='4'
 const r=financialContext('BBCA',future,null,null,expected)
 assert.equal(r.status,'unavailable');assert.equal(r.items.length,0)
 const missing=financialContext('BBCA',report('INCOME_STATEMENT',{unrecognized:200}),null,null,expected)
 assert.ok(missing.notes.some(n=>n.includes('akun tidak dikenali')))
})
test('negative equity is flagged but zero or missing is not positive health',()=>{
 const r=financialContext('BBCA',report('INCOME_STATEMENT',{laba_rugi:0}),report('BALANCE_SHEET',{ekuitas:{ekuitas:-10}}),null,expected)
 assert.equal(r.items[0]!.tone,'neutral');assert.equal(r.items[1]!.tone,'warning');assert.match(r.items[0]!.value,/verifikasi/)
})
