/* GENERATED FROM spec/values.yaml — DO NOT EDIT. Run `pnpm gen:values`. */
export const VALUES = {
  decay: {
    aMin: 0.05,
    halfLifeDays: 30,
    alphaConn: 0.6,
    betaRecent: 0.5,
    gammaEmo: 0.7,
    deltaVal: 0.4,
  },
  consolidation: {
    redistributeLerp: 0.6,
    schemaBonus: 0.15,
    schemaMinCluster: 3,
    schemaMinDegree: 2,
    gistAgeDays: 30,
    gistRecallCutoffDays: 14,
    gistFormSimplify: 0.4,
    weakEdgeThreshold: 0.2,
    weakEdgeIdleDays: 14,
    weakEdgeFloor: 0.05,
  },
} as const
