/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Store_Ornament_Mote_Field_EmptyInputs */

const en_store_ornament_mote_field_empty = /** @type {(inputs: Store_Ornament_Mote_Field_EmptyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Empty`)
};

const ko_store_ornament_mote_field_empty = /** @type {(inputs: Store_Ornament_Mote_Field_EmptyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`아무것도 없이`)
};

/**
* | output |
* | --- |
* | "Empty" |
*
* @param {Store_Ornament_Mote_Field_EmptyInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const store_ornament_mote_field_empty = /** @type {((inputs?: Store_Ornament_Mote_Field_EmptyInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Store_Ornament_Mote_Field_EmptyInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_store_ornament_mote_field_empty(inputs)
	return ko_store_ornament_mote_field_empty(inputs)
});