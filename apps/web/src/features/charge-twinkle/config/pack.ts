// The single v1 payment pack ([G3]): this carries only the pack *identity*, which mirrors
// the backend's DefaultChargePackID — a multi-pack catalog is later content, not a scalar.
// The grant AMOUNT is generated config (VALUES.twinkle.chargePack), read at render, never
// a figure here (CC3).
export const CHARGE_PACK = {
  id: 'twinkle_pack_default',
} as const
