/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Store_Ornament_Mote_Ember_ChipInputs */

const en_store_ornament_mote_ember_chip = /** @type {(inputs: Store_Ornament_Mote_Ember_ChipInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Ember Chip`)
};

const ko_store_ornament_mote_ember_chip = /** @type {(inputs: Store_Ornament_Mote_Ember_ChipInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`불씨 조각`)
};

/**
* | output |
* | --- |
* | "Ember Chip" |
*
* @param {Store_Ornament_Mote_Ember_ChipInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const store_ornament_mote_ember_chip = /** @type {((inputs?: Store_Ornament_Mote_Ember_ChipInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Store_Ornament_Mote_Ember_ChipInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_store_ornament_mote_ember_chip(inputs)
	return ko_store_ornament_mote_ember_chip(inputs)
});