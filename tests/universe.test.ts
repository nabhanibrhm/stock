import test from 'node:test'
import assert from 'node:assert/strict'
import {discoverUniverse,selectUniverse,parseCatalogPage,MAX_CATALOG_PAGES,SCAN_LIMIT} from '../server/services/universe'
const stock=(code:string,cap=1000,ratio=.1)=>({code,name:code,market_cap:cap,turnover_ratio:ratio})
const page=(n:number,data:any[],total=3,pages=2)=>({date:'2026-10-26',page:n,total,total_pages:pages,data})
test('catalog pagination preserves date and deduplicates symbols',async()=>{
 const paths:string[]=[]
 const catalog=await discoverUniverse(async path=>{paths.push(path);return path.includes('page=1&')?page(1,[stock('BBCA'),stock('BBRI')]):page(2,[stock('BBRI'),stock('TLKM')])},'2026-10-26')
 assert.equal(paths.length,2);assert.equal(catalog.stocks.length,3);assert.equal(catalog.complete,true)
 assert.ok(paths.every(p=>p.includes('date=2026-10-26')))
})
test('stale or changing catalog is rejected instead of mixed',async()=>{
 await assert.rejects(()=>discoverUniverse(async()=>({...page(1,[]),date:'2026-10-23'}),'2026-10-26'))
 await assert.rejects(()=>discoverUniverse(async path=>path.includes('page=1&')?page(1,[]):page(2,[],4),'2026-10-26'))
 assert.throws(()=>parseCatalogPage({data:[]}))
})
test('catalog discovery is bounded and explicitly marks incomplete coverage',async()=>{
 let calls=0
 const result=await discoverUniverse(async()=>page(++calls,[],9999,999),'2026-10-26')
 assert.equal(calls,MAX_CATALOG_PAGES);assert.equal(result.complete,false)
})
test('preselection uses turnover proxy, prioritizes holdings, caps scans and excludes index/warrants',()=>{
 const parsed=parseCatalogPage(page(1,[stock('AAAA',1000,.01),stock('BBBB',100,.9),stock('IHSG'),stock('AAAA-W'),stock('CCCC',100,0)]))
 const catalog={stocks:parsed.stocks,date:parsed.date,total:4,pages:1,complete:true}
 assert.deepEqual(selectUniverse(catalog,[],2),['BBBB','AAAA'])
 assert.deepEqual(selectUniverse(catalog,['CCCC'],2),['CCCC','BBBB'])
 assert.throws(()=>selectUniverse(catalog,[],SCAN_LIMIT+1))
})
