/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Palette_Lightness_LightInputs */

const en_palette_lightness_light = /** @type {(inputs: Palette_Lightness_LightInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Light`)
};

const ko_palette_lightness_light = /** @type {(inputs: Palette_Lightness_LightInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`밝게`)
};

/**
* | output |
* | --- |
* | "Light" |
*
* @param {Palette_Lightness_LightInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const palette_lightness_light = /** @type {((inputs?: Palette_Lightness_LightInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Palette_Lightness_LightInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_palette_lightness_light(inputs)
	return ko_palette_lightness_light(inputs)
});