export interface Candle { date: string; open: number; high: number; low: number; close: number; volume: number; value?: number }
export interface Holding { symbol: string; shares: number; entryPrice: number; stop?: number; target?: number; openedDate?: string }
export interface Settings { cash: number; equity: number; riskPct: number; maxPositionPct: number; maxTotalRiskPct: number; buyFeePct: number; sellFeePct: number; slippagePct: number; minDailyValue: number; maxPositions: number }
export interface Setup { action: 'BUY'|'WAIT'; setup: 'breakout'|'pullback'|null; entry: number|null; stop: number|null; target: number|null; reasons: string[]; asOf: string|null }
export interface TradePlan { symbol: string; action: 'BUY'|'WAIT'|'HOLD'|'SELL'; reasons: string[]; entry: number|null; stop: number|null; target: number|null; lots: number; estimatedCost: number; plannedRisk: number; asOf: string|null; expiry: string; strategyVersion: string; setup?: string|null; rank?: number|null; score?: number|null; avgDailyValue?: number|null; historySessions?: number; eligible?: boolean; rankingReasons?: string[] }
export interface UniverseAssessment { eligible: boolean; reasonCodes: string[]; reasons: string[]; avgDailyValue: number|null; historySessions: number; asOf: string|null; missingSessions: number|null; valueEstimated: boolean }

