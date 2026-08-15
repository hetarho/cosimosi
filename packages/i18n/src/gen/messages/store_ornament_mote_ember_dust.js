/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Store_Ornament_Mote_Ember_DustInputs */

const en_store_ornament_mote_ember_dust = /** @type {(inputs: Store_Ornament_Mote_Ember_DustInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Ember Dust`)
};

const ko_store_ornament_mote_ember_dust = /** @type {(inputs: Store_Ornament_Mote_Ember_DustInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`불씨 먼지`)
};

/**
* | output |
* | --- |
* | "Ember Dust" |
*
* @param {Store_Ornament_Mote_Ember_DustInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const store_ornament_mote_ember_dust = /** @type {((inputs?: Store_Ornament_Mote_Ember_DustInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Store_Ornament_Mote_Ember_DustInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_store_ornament_mote_ember_dust(inputs)
	return ko_store_ornament_mote_ember_dust(inputs)
});