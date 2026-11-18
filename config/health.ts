/**
 * Department health (RAG) thresholds — carried over from the workbook's Department Summary rules.
 * Targets set on the Targets page override the defaults where noted in server/kpi-engine.ts → deptHealth().
 */
export const HEALTH_RULES = {
  operations: { amberDelayed: 1, redDelayed: 3 },
  sales: { amberWeightedPipeline: 500000 },
  marketing: { maxCpl: 450 },
  hr: { redUtil: 50, amberUtil: 75 },
  cashflow: { amberNet: 200000 },
};
