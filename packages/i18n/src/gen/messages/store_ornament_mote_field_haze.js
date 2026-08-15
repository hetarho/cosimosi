/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Store_Ornament_Mote_Field_HazeInputs */

const en_store_ornament_mote_field_haze = /** @type {(inputs: Store_Ornament_Mote_Field_HazeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Haze`)
};

const ko_store_ornament_mote_field_haze = /** @type {(inputs: Store_Ornament_Mote_Field_HazeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`멈춘 안개`)
};

/**
* | output |
* | --- |
* | "Haze" |
*
* @param {Store_Ornament_Mote_Field_HazeInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const store_ornament_mote_field_haze = /** @type {((inputs?: Store_Ornament_Mote_Field_HazeInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Store_Ornament_Mote_Field_HazeInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_store_ornament_mote_field_haze(inputs)
	return ko_store_ornament_mote_field_haze(inputs)
});