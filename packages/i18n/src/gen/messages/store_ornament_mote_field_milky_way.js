/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Store_Ornament_Mote_Field_Milky_WayInputs */

const en_store_ornament_mote_field_milky_way = /** @type {(inputs: Store_Ornament_Mote_Field_Milky_WayInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Milky Way`)
};

const ko_store_ornament_mote_field_milky_way = /** @type {(inputs: Store_Ornament_Mote_Field_Milky_WayInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`은하수`)
};

/**
* | output |
* | --- |
* | "Milky Way" |
*
* @param {Store_Ornament_Mote_Field_Milky_WayInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const store_ornament_mote_field_milky_way = /** @type {((inputs?: Store_Ornament_Mote_Field_Milky_WayInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Store_Ornament_Mote_Field_Milky_WayInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_store_ornament_mote_field_milky_way(inputs)
	return ko_store_ornament_mote_field_milky_way(inputs)
});