import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'




test('persistent budget migrates legacy schema and allows only one bounded scan transition',async()=>{
 const temporary=await mkdtemp(join(tmpdir(),'arus-budget-'))
 process.env.DATABASE_URL='file:'+join(temporary,'budget.db').replaceAll('\\','/')
 const store=await import('../server/services/store')
 try {
  await store.db().execute('CREATE TABLE budgets(day TEXT PRIMARY KEY,used INTEGER NOT NULL,last_attempt INTEGER NOT NULL)')
  const now=Date.now(),day='2026-10-26'
  assert.equal(await store.reserveRefresh(day,now,5,'legacy'),true)
  assert.equal(await store.reserveRefresh(day,now+1,86,'broad-universe-1'),true)
  assert.equal(await store.reserveRefresh(day,now+2,86,'broad-universe-1'),false)
  assert.equal(await store.reserveRefresh(day,now+3600002,86,'broad-universe-1'),true)
  assert.equal(await store.reserveRefresh(day,now+7200003,86,'broad-universe-1'),true)
  assert.equal(await store.reserveRefresh(day,now+10800004,86,'broad-universe-1'),true)
  assert.equal(await store.reserveRefresh(day,now+14400005,86,'broad-universe-1'),false)
  const row=(await store.db().execute('SELECT used FROM budgets')).rows[0]
  assert.equal(Number(row?.used),349)
  assert.equal(await store.reserveResearch(day,now+14400006,4,'BBCA'),true)
  assert.equal(await store.reserveResearch(day,now+14400007,4,'BBCA'),false)
  assert.equal(await store.reserveResearch(day,now+14400008,4,'BBRI'),true)
  assert.equal(await store.reserveResearch(day,now+18000007,4,'BBCA'),true)
  assert.equal(await store.reserveResearch(day,now+18000008,40,'TLKM'),false)
  assert.equal(await store.reserveResearch(day,now+18000008,4,'TLKM'),true)
  assert.equal(Number((await store.db().execute('SELECT used FROM budgets')).rows[0]?.used),365)
  const budget=(await store.db().execute('SELECT last_attempt,scope FROM budgets')).rows[0]!
  assert.equal(Number(budget.last_attempt),now+10800004)
  assert.equal(budget.scope,'broad-universe-1')
 }finally{store.db().close();await rm(temporary,{recursive:true,force:true,maxRetries:10,retryDelay:100})}
})

