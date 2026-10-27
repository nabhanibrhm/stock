import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { defaultSettings } from '../shared/engine'

test('journal stores fills and portfolio atomically and retries do not duplicate fills',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'arus-journal-'))
 process.env.DATABASE_URL=pathToFileURL(join(dir,'test.db')).href
 const store=await import('../server/services/store')
 try{
  await store.writeRecord('portfolio',{settings:{...defaultSettings,cash:1000000,equity:1000000},holdings:[]})
  await store.writeRecord('market',{histories:{BBCA:[]},index:[],fetchedAt:'',origin:'test'})
  const {recordTrade,getJournal}=await import('../server/services/journal')
  const fill={id:'durable-fill-001',symbol:'BBCA',side:'BUY',date:'2026-01-02',shares:100,price:1000,fee:150}
  await recordTrade(fill)
  await recordTrade(fill)
  let data=await getJournal()
  assert.equal(data.totalTrades,1);assert.equal(data.portfolio.settings.cash,899850)
  assert.equal(data.portfolio.holdings[0]!.shares,100)
  assert.equal(data.monitoring[0]!.action,'WAIT');assert.equal(data.alerts.length,0)
  await assert.rejects(()=>recordTrade({...fill,id:'bad-sale-001',side:'SELL',shares:200}),/melebihi/)
  data=await getJournal()
  assert.equal(data.totalTrades,1);assert.equal(data.portfolio.settings.cash,899850)
  const responses=await Promise.all([recordTrade({...fill,id:'durable-fill-002'}),recordTrade({...fill,id:'durable-fill-002'})])
  assert.equal(responses.length,2)
  data=await getJournal()
  assert.equal(data.totalTrades,2);assert.equal(data.portfolio.holdings[0]!.shares,200)
  assert.equal(data.portfolio.settings.cash,799700)
 }finally{store.db().close();await rm(dir,{recursive:true,force:true,maxRetries:10,retryDelay:100})}
})
