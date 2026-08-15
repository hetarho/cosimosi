/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Store_Ornament_Mote_Ice_NeedleInputs */

const en_store_ornament_mote_ice_needle = /** @type {(inputs: Store_Ornament_Mote_Ice_NeedleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Ice Needle`)
};

const ko_store_ornament_mote_ice_needle = /** @type {(inputs: Store_Ornament_Mote_Ice_NeedleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`얼음 바늘`)
};

/**
* | output |
* | --- |
* | "Ice Needle" |
*
* @param {Store_Ornament_Mote_Ice_NeedleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const store_ornament_mote_ice_needle = /** @type {((inputs?: Store_Ornament_Mote_Ice_NeedleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Store_Ornament_Mote_Ice_NeedleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_store_ornament_mote_ice_needle(inputs)
	return ko_store_ornament_mote_ice_needle(inputs)
});