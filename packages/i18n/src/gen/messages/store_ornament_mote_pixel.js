/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Store_Ornament_Mote_PixelInputs */

const en_store_ornament_mote_pixel = /** @type {(inputs: Store_Ornament_Mote_PixelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Pixel`)
};

const ko_store_ornament_mote_pixel = /** @type {(inputs: Store_Ornament_Mote_PixelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`픽셀`)
};

/**
* | output |
* | --- |
* | "Pixel" |
*
* @param {Store_Ornament_Mote_PixelInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const store_ornament_mote_pixel = /** @type {((inputs?: Store_Ornament_Mote_PixelInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Store_Ornament_Mote_PixelInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_store_ornament_mote_pixel(inputs)
	return ko_store_ornament_mote_pixel(inputs)
});