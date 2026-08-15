/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Store_Ornament_Mote_Field_PackedInputs */

const en_store_ornament_mote_field_packed = /** @type {(inputs: Store_Ornament_Mote_Field_PackedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Packed`)
};

const ko_store_ornament_mote_field_packed = /** @type {(inputs: Store_Ornament_Mote_Field_PackedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`빼곡히`)
};

/**
* | output |
* | --- |
* | "Packed" |
*
* @param {Store_Ornament_Mote_Field_PackedInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const store_ornament_mote_field_packed = /** @type {((inputs?: Store_Ornament_Mote_Field_PackedInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Store_Ornament_Mote_Field_PackedInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_store_ornament_mote_field_packed(inputs)
	return ko_store_ornament_mote_field_packed(inputs)
});