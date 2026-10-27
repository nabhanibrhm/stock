import { buildManualPrompt, choosePromptSymbols, validatePromptRequest, type PromptSnapshot } from '../../shared/manual-prompts'
import { buildPlans, defaultSettings } from '../../shared/engine'
import { expectedCompletedSession } from '../../shared/calendar'
import type { Holding, Settings } from '../../shared/types'
import { readRecord } from './store'
import type { Market } from './market'
import { cachedResearch } from './research'

/** Cached data only. No provider refresh, AI API, clipboard access, or order execution. */
export async function generateManualPrompt(body:unknown){
 const request=validatePromptRequest(body)
 const [market,portfolio]=await Promise.all([readRecord<Market>('market'),readRecord<{settings:Settings;holdings:Holding[]}>('portfolio')])
 const expected=expectedCompletedSession()
 const settings={...defaultSettings,...portfolio?.settings}
 const holdings=portfolio?.holdings??[]
 const histories=market?.histories??{}
 const index=market?.index??[]
 const asOf=index.at(-1)?.date??''
 const plans=expected?buildPlans(histories,index,holdings,settings,expected):[]
 const snapshot:PromptSnapshot={settings,holdings,plans,histories,index,source:{asOf,fetchedAt:market?.fetchedAt??'',status:asOf&&asOf===expected?'cached':'stale'},expectedSession:expected,calendarStatus:expected?'verified':'unsupported',portfolioSaved:portfolio!==null,universe:market?.scan?{selected:market.scan.selected,discovered:market.scan.discovered,coverage:market.scan.coverage}:undefined,research:{}}
 const symbols=choosePromptSymbols(request,snapshot)
 if(request.includeResearch){
  // Sequential cached reads avoid unbounded work and never call refreshResearch.
  for(const symbol of symbols){try{snapshot.research![symbol]=await cachedResearch(symbol)}catch{/* Missing research/calendar is disclosed by the builder. */}}
 }
 return buildManualPrompt(request,snapshot)
}
