/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Store_Ornament_Mote_Field_EvenInputs */

const en_store_ornament_mote_field_even = /** @type {(inputs: Store_Ornament_Mote_Field_EvenInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Even`)
};

const ko_store_ornament_mote_field_even = /** @type {(inputs: Store_Ornament_Mote_Field_EvenInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`고르게`)
};

/**
* | output |
* | --- |
* | "Even" |
*
* @param {Store_Ornament_Mote_Field_EvenInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const store_ornament_mote_field_even = /** @type {((inputs?: Store_Ornament_Mote_Field_EvenInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Store_Ornament_Mote_Field_EvenInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_store_ornament_mote_field_even(inputs)
	return ko_store_ornament_mote_field_even(inputs)
});