/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Store_Ornament_Mote_Field_FranticInputs */

const en_store_ornament_mote_field_frantic = /** @type {(inputs: Store_Ornament_Mote_Field_FranticInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Frantic`)
};

const ko_store_ornament_mote_field_frantic = /** @type {(inputs: Store_Ornament_Mote_Field_FranticInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`정신없이`)
};

/**
* | output |
* | --- |
* | "Frantic" |
*
* @param {Store_Ornament_Mote_Field_FranticInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const store_ornament_mote_field_frantic = /** @type {((inputs?: Store_Ornament_Mote_Field_FranticInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Store_Ornament_Mote_Field_FranticInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_store_ornament_mote_field_frantic(inputs)
	return ko_store_ornament_mote_field_frantic(inputs)
});