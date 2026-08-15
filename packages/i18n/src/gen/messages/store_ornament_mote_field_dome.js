/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Store_Ornament_Mote_Field_DomeInputs */

const en_store_ornament_mote_field_dome = /** @type {(inputs: Store_Ornament_Mote_Field_DomeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Dome`)
};

const ko_store_ornament_mote_field_dome = /** @type {(inputs: Store_Ornament_Mote_Field_DomeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`돔`)
};

/**
* | output |
* | --- |
* | "Dome" |
*
* @param {Store_Ornament_Mote_Field_DomeInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const store_ornament_mote_field_dome = /** @type {((inputs?: Store_Ornament_Mote_Field_DomeInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Store_Ornament_Mote_Field_DomeInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_store_ornament_mote_field_dome(inputs)
	return ko_store_ornament_mote_field_dome(inputs)
});