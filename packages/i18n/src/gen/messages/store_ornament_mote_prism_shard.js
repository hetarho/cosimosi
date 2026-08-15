/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Store_Ornament_Mote_Prism_ShardInputs */

const en_store_ornament_mote_prism_shard = /** @type {(inputs: Store_Ornament_Mote_Prism_ShardInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Prism Shard`)
};

const ko_store_ornament_mote_prism_shard = /** @type {(inputs: Store_Ornament_Mote_Prism_ShardInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`프리즘 조각`)
};

/**
* | output |
* | --- |
* | "Prism Shard" |
*
* @param {Store_Ornament_Mote_Prism_ShardInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const store_ornament_mote_prism_shard = /** @type {((inputs?: Store_Ornament_Mote_Prism_ShardInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Store_Ornament_Mote_Prism_ShardInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_store_ornament_mote_prism_shard(inputs)
	return ko_store_ornament_mote_prism_shard(inputs)
});