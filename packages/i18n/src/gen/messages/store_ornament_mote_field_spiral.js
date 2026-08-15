/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Store_Ornament_Mote_Field_SpiralInputs */

const en_store_ornament_mote_field_spiral = /** @type {(inputs: Store_Ornament_Mote_Field_SpiralInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Spiral`)
};

const ko_store_ornament_mote_field_spiral = /** @type {(inputs: Store_Ornament_Mote_Field_SpiralInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`나선`)
};

/**
* | output |
* | --- |
* | "Spiral" |
*
* @param {Store_Ornament_Mote_Field_SpiralInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const store_ornament_mote_field_spiral = /** @type {((inputs?: Store_Ornament_Mote_Field_SpiralInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Store_Ornament_Mote_Field_SpiralInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_store_ornament_mote_field_spiral(inputs)
	return ko_store_ornament_mote_field_spiral(inputs)
});