import { createClient, type Client } from '@libsql/client'
import { mkdirSync } from 'node:fs'
let client: Client | undefined
let ready: Promise<void> | undefined
let writeQueue:Promise<unknown>=Promise.resolve()
/** Serialize local SQLite writers; database transactions also protect remote instances. Do not nest. */
export function withStoreWrite<T>(operation:()=>Promise<T>):Promise<T>{
 const result=writeQueue.then(operation,operation)
 writeQueue=result.then(()=>undefined,()=>undefined)
 return result
}
export function db() {
 if (!client) {
  if (process.env.VERCEL && (!process.env.DATABASE_URL || !/^libsql:\/\//.test(process.env.DATABASE_URL))) throw new Error('Hosted database is required on Vercel')
  if (!process.env.DATABASE_URL) mkdirSync('data', { recursive: true })
  client = createClient({ url: process.env.DATABASE_URL || 'file:data/arus.db', authToken: process.env.DATABASE_AUTH_TOKEN })
 }
 return client
}
export async function initStore() {
 ready ||= (async () => {
  await db().execute('CREATE TABLE IF NOT EXISTS records (key TEXT PRIMARY KEY, value TEXT NOT NULL)')
  await db().execute('CREATE TABLE IF NOT EXISTS budgets (day TEXT PRIMARY KEY, used INTEGER NOT NULL, last_attempt INTEGER NOT NULL, scope TEXT NOT NULL DEFAULT "legacy")')
  const columns=await db().execute('PRAGMA table_info(budgets)')
  if(!columns.rows.some(r=>r.name==='scope'))await db().execute('ALTER TABLE budgets ADD COLUMN scope TEXT NOT NULL DEFAULT "legacy"')
 })()
 return ready
}
export async function readRecord<T>(key: string): Promise<T | null> {
 await initStore(); const result = await db().execute({ sql: 'SELECT value FROM records WHERE key=?', args: [key] })
 return result.rows.length ? JSON.parse(String(result.rows[0]!.value)) as T : null
}
export async function writeRecord(key: string, value: unknown) {
 await initStore(); await withStoreWrite(()=>db().execute({ sql: 'INSERT INTO records(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', args: [key, JSON.stringify(value)] }))
}
export const DAILY_REQUEST_BUDGET=400
export async function reserveRefresh(day: string, now: number, cost=5, scope='legacy') {
 if(!Number.isInteger(cost)||cost<1||cost>DAILY_REQUEST_BUDGET)throw new Error('Invalid refresh reservation')
 await initStore()
 return withStoreWrite(async()=>{
 await db().execute({sql:'INSERT OR IGNORE INTO budgets(day,used,last_attempt,scope) VALUES(?,0,0,?)',args:[day,scope]})
 // A one-time transition from the old four-stock scan may run immediately, without resetting usage.
 const result=await db().execute({sql:'UPDATE budgets SET used=used+?,last_attempt=?,scope=? WHERE day=? AND used<=? AND (last_attempt<? OR (scope=\'legacy\' AND ?<>\'legacy\'))',args:[cost,now,scope,day,DAILY_REQUEST_BUDGET-cost,now-3600000,scope]})
 return result.rowsAffected === 1
 })
}
/** Research shares the daily budget, but not the scanner's hourly cooldown. */
export async function reserveResearch(day: string, now: number, cost: number, symbol: string) {
 if(!Number.isInteger(cost)||cost<1||cost>DAILY_REQUEST_BUDGET||!Number.isFinite(now)||!/^\d{4}-\d{2}-\d{2}$/.test(day)||!/^([A-Z]{4})$/.test(symbol))throw new Error('Invalid research reservation')
 await initStore()
 return withStoreWrite(async()=>{
 await db().execute('CREATE TABLE IF NOT EXISTS research_attempts (symbol TEXT PRIMARY KEY, last_attempt INTEGER NOT NULL)')
 const tx=await db().transaction('write')
 try {
  const prior=await tx.execute({sql:'SELECT last_attempt FROM research_attempts WHERE symbol=?',args:[symbol]})
  if(prior.rows.length && Number(prior.rows[0]!.last_attempt)>now-3600000){await tx.rollback();return false}
  await tx.execute({sql:'INSERT OR IGNORE INTO budgets(day,used,last_attempt,scope) VALUES(?,0,0,?)',args:[day,'legacy']})
  const updated=await tx.execute({sql:'UPDATE budgets SET used=used+? WHERE day=? AND used<=?',args:[cost,day,DAILY_REQUEST_BUDGET-cost]})
  if(updated.rowsAffected!==1){await tx.rollback();return false}
  await tx.execute({sql:'INSERT INTO research_attempts(symbol,last_attempt) VALUES(?,?) ON CONFLICT(symbol) DO UPDATE SET last_attempt=excluded.last_attempt',args:[symbol,now]})
  await tx.commit();return true
 } catch(error){await tx.rollback();throw error} finally{tx.close()}
 })
}
