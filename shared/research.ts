export type ResearchStatus='available'|'partial'|'unavailable'|'stale'
export interface ResearchItem {label:string;value:string;tone:'neutral'|'positive'|'warning'}
export interface ResearchSection {status:ResearchStatus;asOf:string|null;items:ResearchItem[];notes:string[]}
export interface ProviderAnalysis {status:ResearchStatus;asOf:string|null;output:string;notes:string[]}
export interface ResearchReport {symbol:string;fetchedAt:string;expectedSession:string;broker:ResearchSection;financial:ResearchSection;analysis:ProviderAnalysis;notes:string[]}
export const RESEARCH_VERSION='arjum-context-1'
const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v)
const date=(v:unknown):v is string=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v
const money=(v:number)=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(v)
export function emptySection(note:string):ResearchSection{return {status:'unavailable',asOf:null,items:[],notes:[note]}}
export function providerAnalysis(symbol:string,body:any,expected:string):ProviderAnalysis {
 const result:ProviderAnalysis={status:'unavailable',asOf:null,output:'',notes:['Analisa dari Arjum; label AI mengikuti provider. Model, metode pembangkitan, dan kinerja klaim historis belum diverifikasi.','Rekomendasi dan level harga provider terpisah dari sinyal, ukuran posisi, dan batas risiko aplikasi; tidak diterapkan otomatis.']}
 if(body?.stock_code!==symbol||typeof body?.output!=='string'||!body.output.trim()||body.output.length>30000){result.notes.push('Analisa belum tersedia atau format/simbol tidak valid.');return result}
 const heading=body.output.split('\n')[0]||''
 const headerSymbol=heading.match(/\*\*([A-Z]{4})\*\*/)?.[1]
 if(headerSymbol&&headerSymbol!==symbol){result.notes.push('Kode saham dalam judul tidak cocok; analisa ditolak.');return result}
 const match=heading.match(/Analisis\s+[^,\n]+,\s*(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/i)
 const months:Record<string,string>={jan:'01',feb:'02',mar:'03',apr:'04',mei:'05',jun:'06',jul:'07',agu:'08',ags:'08',sep:'09',okt:'10',nov:'11',des:'12'}
 const month=match?months[match[2]!.slice(0,3).toLowerCase()]:undefined
 const source=match&&month?`${match[3]}-${month}-${match[1]!.padStart(2,'0')}`:null
 if(source&&(!date(source)||source>expected)){result.notes.push('Tanggal analisa tidak valid atau melewati sesi yang diharapkan; analisa ditolak.');return result}
 result.output=body.output;result.asOf=source
 result.status=source===expected?'available':source?'stale':'partial'
 if(!source)result.notes.push('Tanggal observasi tidak dikenali dari judul; waktu unduh tidak dianggap tanggal data.')
 else if(source!==expected)result.notes.push(`Analisa berasal dari ${source}; sesi diharapkan ${expected}. Hanya referensi historis.`)
 return result
}
export function brokerContext(symbol:string,foreign:any,domestic:any,accumulation:any,expected:string):ResearchSection {
 const result:ResearchSection={status:'available',asOf:null,items:[],notes:['Nilai broker dalam rupiah; net = beli dikurangi jual. Daftar broker terbatas, bukan total arus asing/domestik. Aktivitas broker bukan bukti pemilik akhir atau prediksi harga.']}
 const dates:string[]=[];let missing=0;let stale=false
 for(const [body,flow,label] of [[foreign,'F','Asing'],[domestic,'D','Domestik']] as const){
  if(body?.stock_code!==symbol||body?.flow!==flow||!date(body?.broker_end_date)||!date(body?.broker_start_date)||body.broker_start_date!==body.broker_end_date||!Array.isArray(body?.brokers)){missing++;result.notes.push(`${label}: data tidak tersedia atau format/tanggal tidak valid.`);continue}
  if(body.broker_end_date>expected){missing++;result.notes.push(`${label}: tanggal di masa depan ditolak.`);continue}
  dates.push(body.broker_end_date);stale ||= body.broker_end_date!==expected
  const rows=body.brokers.filter((r:any)=>/^[A-Z0-9]{2,4}$/.test(r?.broker_code)&&finite(r.bval)&&r.bval>=0&&finite(r.sval)&&r.sval>=0&&finite(r.nval)&&Math.abs(r.nval-(r.bval-r.sval))<=Math.max(1,Math.abs(r.nval)*1e-8)).slice(0,5)
  if(!rows.length){missing++;result.notes.push(`${label}: tidak ada baris broker valid.`)}
  for(const r of rows)result.items.push({label:`${label} · ${r.broker_code} · ${body.broker_end_date}`,value:`Net ${money(r.nval)} (${r.nval>0?'beli bersih':r.nval<0?'jual bersih':'seimbang'})`,tone:'neutral'})
 }
 if(accumulation?.code===symbol&&date(accumulation.start_date)&&date(accumulation.end_date)&&accumulation.start_date<=accumulation.end_date&&accumulation.end_date<=expected&&Array.isArray(accumulation.series)){
  let valid=0
  for(const series of accumulation.series.slice(0,6)){
   if(!/^[A-Z0-9]{2,4}$/.test(series?.broker_code)||!Array.isArray(series.points))continue
   const points=series.points.filter((p:any)=>date(p.date)&&p.date>=accumulation.start_date&&p.date<=accumulation.end_date&&finite(p.nval)).sort((a:any,b:any)=>a.date.localeCompare(b.date))
   if(!points.length||new Set(points.map((p:any)=>p.date)).size!==points.length)continue
   const end=points.at(-1)!.date;const net=points.reduce((sum:number,p:any)=>sum+p.nval,0)
   if(!finite(net))continue
   valid++;dates.push(end);stale ||=end!==expected
   result.items.push({label:`Akumulasi ${series.broker_code} · ${points[0].date}–${end}`,value:`${money(net)} dari ${points.length} sesi tersedia`,tone:'neutral'})
  }
  if(!valid){missing++;result.notes.push('Riwayat akumulasi tidak memiliki titik valid.')}
  result.notes.push('Akumulasi menjumlahkan net harian pada periode yang tersedia; pemilihan broker oleh provider dapat bias. Sesi yang hilang tidak diisi nol.')
 }else{missing++;result.notes.push('Riwayat akumulasi tidak tersedia atau metadata tidak valid.')}
 result.asOf=dates.sort()[0]||null
 result.status=!result.items.length?'unavailable':stale?'stale':missing?'partial':'available'
 if(stale)result.notes.push(`Sebagian data belum mencapai sesi ${expected}; hanya konteks historis.`)
 return result
}
function flattened(obj:any,prefix='',out:Record<string,number>={}):Record<string,number>{
 if(!obj||typeof obj!=='object'||Array.isArray(obj))return out
 for(const [key,value] of Object.entries(obj)){const path=prefix?`${prefix}.${key}`:key;if(finite(value))out[path]=value;else if(value&&typeof value==='object'&&path.length<500)flattened(value,path,out)}return out
}
function uniqueValue(data:any,keys:string[]):number|null{
 const flat=flattened(data)
 for(const key of keys){const matches=Object.entries(flat).filter(([path])=>path===key||path.endsWith('.'+key));if(matches.length===1)return matches[0]![1]}
 return null
}
function latestStatement(body:any,symbol:string,type:string,expected:string){
 if(body?.stock_code!==symbol||body?.report_type!==type||body?.period!=='quarterly'||!Array.isArray(body.items))return null
 const items=body.items.filter((item:any)=>/^\d{4}$/.test(String(item?.year))&&/^[1-4]$/.test(String(item?.quarter))&&item.data&&typeof item.data==='object').map((item:any)=>({...item,end:new Date(Date.UTC(Number(item.year),Number(item.quarter)*3,0)).toISOString().slice(0,10)})).filter((item:any)=>item.end<=expected)
 return items.sort((a:any,b:any)=>b.end.localeCompare(a.end))[0]||null
}
export function financialContext(symbol:string,income:any,balance:any,cashflow:any,expected:string):ResearchSection {
 const result:ResearchSection={status:'partial',asOf:null,items:[],notes:['Tanggal di bawah adalah akhir periode laporan, bukan tanggal publikasi. fetched_at provider bukan bukti tanggal publikasi; data tidak digunakan untuk backtest atau peringkat sinyal.','Mata uang/skala dan basis kuartal vs kumulatif belum dikonfirmasi provider. Hanya tanda nilai digunakan; tidak menghitung pertumbuhan, margin atau rasio lintas laporan.']}
 const reports=[latestStatement(income,symbol,'INCOME_STATEMENT',expected),latestStatement(balance,symbol,'BALANCE_SHEET',expected),latestStatement(cashflow,symbol,'CASH_FLOW_REPORT',expected)]
 const bank=Boolean(reports[1]&&Object.keys(flattened(reports[1].data)).some(k=>k.includes('simpanan_nasabah')))
 const descriptors=[['Laba/rugi',['laba_rugi']],['Ekuitas',['ekuitas.ekuitas','ekuitas.total','jumlah_ekuitas']],['Arus kas operasi',['arus_kas_bersih_yang_diperoleh_dari_digunakan_untuk_aktivitas_operasi']]] as const
 reports.forEach((report,index)=>{
  const [label,keys]=descriptors[index]!
  if(!report){result.notes.push(`${label}: laporan yang sesuai belum tersedia.`);return}
  const value=uniqueValue(report.data,[...keys]);result.asOf=!result.asOf||report.end<result.asOf?report.end:result.asOf
  if(value===null){result.notes.push(`${label}: akun tidak dikenali atau ambigu; tidak disimpulkan.`);return}
  result.items.push({label:`${label} · Q${report.quarter} ${report.year}`,value:value>0?'Positif':value<0?'Negatif':'Nol (perlu verifikasi)',tone:value<0&&!(index===2&&bank)?'warning':'neutral'})
 })
 const liabilities=reports[1]?uniqueValue(reports[1].data,['liabilitas.liabilitas','liabilitas.total','jumlah_liabilitas']):null
 result.items.push({label:'Utang dan struktur modal',value:liabilities===null?'Data liabilitas belum dikenali':bank?'Struktur bank terdeteksi; simpanan nasabah bukan utang industri biasa':'Liabilitas tersedia; belum memisahkan utang berbunga',tone:'neutral'})
 result.notes.push(bank?'Format perbankan terdeteksi dari akun simpanan nasabah. Arus kas operasi negatif tidak otomatis berarti bank tidak sehat.':'Klasifikasi sektor belum terverifikasi; ambang utang dan penilaian kesehatan menyeluruh tidak diterapkan.')
 const age=result.asOf?(Date.parse(expected)-Date.parse(result.asOf))/86400000:null
 if(age!==null&&age>200){result.status='stale';result.notes.push('Periode laporan tertua yang ditampilkan sudah lebih dari 200 hari; periksa keterbaruan laporan.')}
 if(!reports.some(Boolean)){result.status='unavailable';result.items=[]}
 return result
}
