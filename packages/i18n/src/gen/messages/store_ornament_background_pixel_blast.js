/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Store_Ornament_Background_Pixel_BlastInputs */

const en_store_ornament_background_pixel_blast = /** @type {(inputs: Store_Ornament_Background_Pixel_BlastInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Pixel Blast`)
};

const ko_store_ornament_background_pixel_blast = /** @type {(inputs: Store_Ornament_Background_Pixel_BlastInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`픽셀 블라스트`)
};

/**
* | output |
* | --- |
* | "Pixel Blast" |
*
* @param {Store_Ornament_Background_Pixel_BlastInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const store_ornament_background_pixel_blast = /** @type {((inputs?: Store_Ornament_Background_Pixel_BlastInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Store_Ornament_Background_Pixel_BlastInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_store_ornament_background_pixel_blast(inputs)
	return ko_store_ornament_background_pixel_blast(inputs)
});