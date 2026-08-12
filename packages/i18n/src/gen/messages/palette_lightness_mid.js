/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Palette_Lightness_MidInputs */

const en_palette_lightness_mid = /** @type {(inputs: Palette_Lightness_MidInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Mid`)
};

const ko_palette_lightness_mid = /** @type {(inputs: Palette_Lightness_MidInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`중간`)
};

/**
* | output |
* | --- |
* | "Mid" |
*
* @param {Palette_Lightness_MidInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const palette_lightness_mid = /** @type {((inputs?: Palette_Lightness_MidInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Palette_Lightness_MidInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_palette_lightness_mid(inputs)
	return ko_palette_lightness_mid(inputs)
});