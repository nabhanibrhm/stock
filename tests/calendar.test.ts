import test from 'node:test'
import assert from 'node:assert/strict'
import {CALENDAR_COVERAGE,IDX_HOLIDAYS_2026,expectedCompletedSession,holdingSchedule,isTradingSession,nextTradingSession} from '../shared/calendar'

test('verified 2026 calendar matches the notice total and excludes every listed closure',()=>{
 let sessions=0
 for(let day=new Date(CALENDAR_COVERAGE.start);day.toISOString().slice(0,10)<=CALENDAR_COVERAGE.end;day.setUTCDate(day.getUTCDate()+1))if(isTradingSession(day.toISOString().slice(0,10)))sessions++
 assert.equal(sessions,239)
 assert.equal(IDX_HOLIDAYS_2026.size,22)
 for(const date of IDX_HOLIDAYS_2026)assert.equal(isTradingSession(date),false)
 assert.equal(isTradingSession('2026-10-24'),false)
 assert.equal(isTradingSession('2026-10-26'),true)
 assert.equal(isTradingSession('2025-12-30'),null)
 assert.equal(isTradingSession('2027-01-04'),null)
 assert.equal(isTradingSession('2026-02-30'),null)
})

test('18:00 WIB cutoff, weekends and the August holiday use the last completed exchange session',()=>{
 assert.equal(expectedCompletedSession(new Date('2026-08-18T10:59:59Z')),'2026-08-14')
 assert.equal(expectedCompletedSession(new Date('2026-08-18T11:00:00Z')),'2026-08-18')
 assert.equal(expectedCompletedSession(new Date('2026-08-17T13:00:00Z')),'2026-08-14')
 assert.equal(expectedCompletedSession(new Date('2026-08-16T13:00:00Z')),'2026-08-14')
 assert.equal(expectedCompletedSession(new Date('2026-01-02T10:00:00Z')),null)
 assert.equal(expectedCompletedSession(new Date('2027-01-04T12:00:00Z')),null)
 assert.equal(expectedCompletedSession(new Date('invalid')),null)
})

test('purchase is day one and ten-session opening exit skips weekends and exchange holidays',()=>{
 assert.equal(nextTradingSession('2026-08-14'),'2026-08-18')
 const schedule=holdingSchedule('2026-08-14',10,'2026-08-28')
 assert.deepEqual(schedule,{holdingSessions:10,heldSessions:9,plannedExitDate:'2026-08-31',calendarStatus:'verified'})
 assert.equal(holdingSchedule('2026-08-14',10,'2026-08-14').heldSessions,1)
 assert.equal(holdingSchedule('2026-08-14',3,'2026-08-18').plannedExitDate,'2026-08-19')
 assert.equal(holdingSchedule('2026-08-14',15,'2026-08-14').plannedExitDate,'2026-09-07')
})

test('unknown years, year-end deadlines, missing entries and impossible sessions never guess a date',()=>{
 for(const [entry,asOf] of [['2025-12-30','2026-01-05'],['2026-12-23','2026-12-23'],['2026-12-01','2027-01-04']]){
  const schedule=holdingSchedule(entry,15,asOf!)
  assert.equal(schedule.calendarStatus,'unsupported');assert.equal(schedule.plannedExitDate,null);assert.equal(schedule.heldSessions,null)
 }
 assert.equal(holdingSchedule(undefined,15,'2026-10-26').calendarStatus,'missing-entry')
 assert.equal(holdingSchedule('2026-08-17',3,'2026-08-18').calendarStatus,'invalid-entry')
 assert.equal(holdingSchedule('2026-02-30',3,'2026-08-18').calendarStatus,'invalid-entry')
 for(const horizon of [2,16,3.5,NaN])assert.equal(holdingSchedule('2026-08-14',horizon,'2026-08-18').calendarStatus,'unsupported')
})
