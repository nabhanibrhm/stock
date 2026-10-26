/** Bounded universe discovery. Recent turnover is only a preselection proxy;
 * actual 20-session liquidity and history are validated by the shared engine. */
export const SCAN_LIMIT = 60
export const MAX_CATALOG_PAGES = 25
export const SCAN_REQUEST_RESERVATION = MAX_CATALOG_PAGES + SCAN_LIMIT + 1
export const SCAN_VERSION = 'broad-universe-1'
export interface UniverseStock {symbol:string;name:string;marketCap:number;turnover:number;estimatedValue:number}
export interface Catalog {stocks:UniverseStock[];date:string;total:number;pages:number;complete:boolean}
export type ProviderRead = (path:string)=>Promise<any>
export function parseCatalogPage(body:any) {
 if(!body || !Array.isArray(body.data) || !/^\d{4}-\d{2}-\d{2}$/.test(body.date) || !Number.isInteger(body.total) || body.total<0 || !Number.isInteger(body.total_pages) || body.total_pages<1 || !Number.isInteger(body.page)) throw new Error('Format katalog Arjum tidak valid.')
 const stocks:UniverseStock[]=body.data.flatMap((s:any)=>{
  if(!s || typeof s.code!=='string' || !/^[A-Z]{4}$/.test(s.code) || s.code==='IHSG')return []
  const cap=Number(s.market_cap),turnover=Number(s.turnover_ratio)
  return [{symbol:s.code,name:typeof s.name==='string'?s.name:s.code,marketCap:Number.isFinite(cap)&&cap>0?cap:0,turnover:Number.isFinite(turnover)&&turnover>0?turnover:0,estimatedValue:Number.isFinite(cap)&&Number.isFinite(turnover)&&cap>0&&turnover>0?cap*turnover:0}]
 })
 return {stocks,date:body.date as string,total:body.total as number,pages:body.total_pages as number,page:body.page as number}
}
export async function discoverUniverse(read:ProviderRead,date:string):Promise<Catalog>{
 const first=parseCatalogPage(await read(`/api/market-cap?page=1&per_page=50&date=${date}`))
 if(first.date!==date || first.page!==1)throw new Error('Tanggal/halaman katalog tidak sesuai sesi yang diharapkan.')
 const bySymbol=new Map(first.stocks.map(s=>[s.symbol,s]))
 let readPages=1
 for(let page=2;page<=Math.min(first.pages,MAX_CATALOG_PAGES);page++){
  const current=parseCatalogPage(await read(`/api/market-cap?page=${page}&per_page=50&date=${date}`))
  if(current.date!==date||current.page!==page||current.total!==first.total||current.pages!==first.pages)throw new Error('Katalog berubah selama pemindaian; coba lagi nanti.')
  for(const stock of current.stocks)bySymbol.set(stock.symbol,stock)
  readPages++
 }
 return {stocks:[...bySymbol.values()],date,total:first.total,pages:readPages,complete:readPages===first.pages}
}
export function selectUniverse(catalog:Catalog,heldSymbols:string[],limit=SCAN_LIMIT):string[]{
 if(!Number.isInteger(limit)||limit<1||limit>SCAN_LIMIT)throw new Error('Batas pemindaian tidak valid.')
 const held=[...new Set(heldSymbols)].sort()
 if(held.length>limit||held.some(s=>!/^[A-Z]{4}$/.test(s)))throw new Error('Jumlah/kode posisi melebihi batas pemindaian.')
 const ranked=catalog.stocks.slice().sort((a,b)=>b.estimatedValue-a.estimatedValue || b.marketCap-a.marketCap || a.symbol.localeCompare(b.symbol))
 return [...new Set([...held,...ranked.filter(s=>s.estimatedValue>0).map(s=>s.symbol)])].slice(0,limit)
}
