import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { defaultSettings } from '../shared/engine'
import {validatePortfolio} from '../server/services/validation'

test('portfolio validation defaults legacy horizons and enforces integer bounds for settings and positions',()=>{
 const {holdingSessions,...legacy}=defaultSettings
 const h={symbol:'BBCA',shares:100,entryPrice:1000}
 const old=validatePortfolio({settings:legacy,holdings:[h]})
 assert.equal(old.settings.holdingSessions,15);assert.equal(old.holdings[0]!.holdingSessions,15)
 const chosen=validatePortfolio({settings:{...defaultSettings,holdingSessions:3},holdings:[{...h,holdingSessions:10}]})
 assert.equal(chosen.settings.holdingSessions,3);assert.equal(chosen.holdings[0]!.holdingSessions,10)
 for(const horizon of [2,16,3.5,'10',NaN]){
  assert.throws(()=>validatePortfolio({settings:{...defaultSettings,holdingSessions:horizon},holdings:[]}),/pegang|pengaturan/)
  assert.throws(()=>validatePortfolio({settings:defaultSettings,holdings:[{...h,holdingSessions:horizon}]}),/pegang/)
 }
})

test('journal protects actual cash and holdings from stale settings saves, while risk and stops remain editable',async()=>{
 const temporary=await mkdtemp(join(tmpdir(),'arus-portfolio-'))
 process.env.DATABASE_URL='file:'+join(temporary,'test.db').replaceAll('\\','/')
 const store=await import('../server/services/store')
 const {savePortfolio}=await import('../server/services/portfolio')
 try{
  const portfolio={settings:{...defaultSettings},holdings:[{symbol:'BBCA',shares:100,entryPrice:1000,stop:900}]}
  await savePortfolio(portfolio)
  await store.writeRecord('journal',{trades:[{id:'test-existing-fill'}]})
  await assert.rejects(()=>savePortfolio({...portfolio,settings:{...portfolio.settings,cash:1}}),/jurnal transaksi/)
  await assert.rejects(()=>savePortfolio({...portfolio,holdings:[]}),/jurnal transaksi/)
  await assert.rejects(()=>savePortfolio({...portfolio,holdings:[{...portfolio.holdings[0]!,shares:200}]}),/jurnal transaksi/)
  await assert.rejects(()=>savePortfolio({...portfolio,holdings:[{...portfolio.holdings[0]!,holdingSessions:10}]}),/jurnal transaksi/)
  assert.deepEqual(await store.readRecord('portfolio'),portfolio)
  const updated={settings:{...portfolio.settings,riskPct:1},holdings:[{...portfolio.holdings[0]!,stop:950,target:1200}]}
  await savePortfolio(updated)
  assert.deepEqual(await store.readRecord('portfolio'),updated)
 }finally{store.db().close();await rm(temporary,{recursive:true,force:true,maxRetries:10,retryDelay:100})}
})
