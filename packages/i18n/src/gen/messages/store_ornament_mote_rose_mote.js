/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Store_Ornament_Mote_Rose_MoteInputs */

const en_store_ornament_mote_rose_mote = /** @type {(inputs: Store_Ornament_Mote_Rose_MoteInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Rose Mote`)
};

const ko_store_ornament_mote_rose_mote = /** @type {(inputs: Store_Ornament_Mote_Rose_MoteInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`장밋빛 알갱이`)
};

/**
* | output |
* | --- |
* | "Rose Mote" |
*
* @param {Store_Ornament_Mote_Rose_MoteInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const store_ornament_mote_rose_mote = /** @type {((inputs?: Store_Ornament_Mote_Rose_MoteInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Store_Ornament_Mote_Rose_MoteInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_store_ornament_mote_rose_mote(inputs)
	return ko_store_ornament_mote_rose_mote(inputs)
});