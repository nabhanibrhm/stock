import { createClient, type Client } from '@libsql/client'
import { mkdirSync } from 'node:fs'
let client: Client | undefined
let ready: Promise<void> | undefined
export function db() {
 if (!client) {
  if (process.env.VERCEL && (!process.env.DATABASE_URL || !/^libsql:\/\//.test(process.env.DATABASE_URL))) throw new Error('Hosted database is required on Vercel')
  if (!process.env.DATABASE_URL) mkdirSync('data', { recursive: true })
  client = createClient({ url: process.env.DATABASE_URL || 'file:data/arus.db', authToken: process.env.DATABASE_AUTH_TOKEN })
 }
 return client
}
export async function initStore() {
 ready ||= (async () => { await db().execute('CREATE TABLE IF NOT EXISTS records (key TEXT PRIMARY KEY, value TEXT NOT NULL)'); await db().execute('CREATE TABLE IF NOT EXISTS budgets (day TEXT PRIMARY KEY, used INTEGER NOT NULL, last_attempt INTEGER NOT NULL)') })()
 return ready
}
export async function readRecord<T>(key: string): Promise<T | null> {
 await initStore(); const result = await db().execute({ sql: 'SELECT value FROM records WHERE key=?', args: [key] })
 return result.rows.length ? JSON.parse(String(result.rows[0]!.value)) as T : null
}
export async function writeRecord(key: string, value: unknown) {
 await initStore(); await db().execute({ sql: 'INSERT INTO records(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', args: [key, JSON.stringify(value)] })
}
export async function reserveRefresh(day: string, now: number) {
 await initStore()
 await db().execute({sql:'INSERT OR IGNORE INTO budgets(day,used,last_attempt) VALUES(?,0,0)',args:[day]})
 const result=await db().execute({sql:'UPDATE budgets SET used=used+5,last_attempt=? WHERE day=? AND used<=15 AND last_attempt<?',args:[now,day,now-3600000]})
 return result.rowsAffected === 1
}

