/** IDX 2026 notice Peng-00171/BEI.POP/09-2025, corroborated by KSEI PENG-0002/DIR/KSEI/0126. */
export const CALENDAR_VERSION='idx-2026-2025-09-23'
export const CALENDAR_COVERAGE={start:'2026-01-01',end:'2026-12-31',verifiedAt:'2026-10-27',source:'https://web.ksei.co.id/files/1767843003_Penyesuaian_Pengumuman_Hari_Libur_dan_Cuti_Bersama_PT_KSEI_Ta....pdf',exchangeSource:'https://suprasekuritas.co.id/storage/2026/01/Peng-00171-Libur-Bursa-2026-2.pdf'}
export const IDX_HOLIDAYS_2026=new Set(['2026-01-01','2026-01-16','2026-02-16','2026-02-17','2026-03-18','2026-03-19','2026-03-20','2026-03-23','2026-03-24','2026-04-03','2026-05-01','2026-05-14','2026-05-15','2026-05-27','2026-05-28','2026-06-01','2026-06-16','2026-08-17','2026-08-25','2026-12-24','2026-12-25','2026-12-31'])
export type CalendarStatus='verified'|'unsupported'|'missing-entry'|'invalid-entry'|'historical-observed'
export const validCalendarDate=(date:string)=>/^\d{4}-\d{2}-\d{2}$/.test(date)&&Number.isFinite(Date.parse(date))&&new Date(date).toISOString().slice(0,10)===date
export const calendarCoverage=(date:string)=>validCalendarDate(date)&&date>=CALENDAR_COVERAGE.start&&date<=CALENDAR_COVERAGE.end
const move=(date:string,days:number)=>new Date(Date.parse(date)+days*86400000).toISOString().slice(0,10)
export function isTradingSession(date:string):boolean|null{
 if(!calendarCoverage(date))return null
 return ![0,6].includes(new Date(date).getUTCDay())&&!IDX_HOLIDAYS_2026.has(date)
}
export function nextTradingSession(date:string):string|null{
 if(!validCalendarDate(date))return null
 for(let i=1;i<=30;i++){const candidate=move(date,i),open=isTradingSession(candidate);if(open===null)return null;if(open)return candidate}
 return null
}
/** Completed EOD data is expected only after 18:00 WIB, including on trading holidays. */
export function expectedCompletedSession(now=new Date()):string|null{
 if(!Number.isFinite(now.getTime()))return null
 const wib=new Date(now.getTime()+7*3600000)
 const day=wib.toISOString().slice(0,10)
 if(!calendarCoverage(day))return null
 let candidate=wib.getUTCHours()<18?move(day,-1):day
 for(let i=0;i<30;i++){const open=isTradingSession(candidate);if(open===null)return null;if(open)return candidate;candidate=move(candidate,-1)}
 return null
}
export function holdingSchedule(openedDate:string|undefined,holdingSessions:number,asOf:string):{holdingSessions:number;heldSessions:number|null;plannedExitDate:string|null;calendarStatus:CalendarStatus}{
 const base={holdingSessions,heldSessions:null as number|null,plannedExitDate:null as string|null,calendarStatus:'unsupported' as CalendarStatus}
 if(!Number.isInteger(holdingSessions)||holdingSessions<3||holdingSessions>15)return base
 if(!openedDate)return {...base,calendarStatus:'missing-entry'}
 if(!validCalendarDate(openedDate)||!validCalendarDate(asOf))return {...base,calendarStatus:'invalid-entry'}
 const open=isTradingSession(openedDate)
 if(open===false)return {...base,calendarStatus:'invalid-entry'}
 if(open===null||!calendarCoverage(asOf))return base
 let count=1,exit=openedDate
 while(count<holdingSessions){const next=nextTradingSession(exit);if(!next)return base;exit=next;count++}
 let held=0
 for(let day=openedDate;day<=asOf;day=move(day,1)){const session=isTradingSession(day);if(session===null)return base;if(session)held++}
 return {...base,heldSessions:held,plannedExitDate:exit,calendarStatus:'verified'}
}
