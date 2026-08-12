/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Palette_Lightness_DeepInputs */

const en_palette_lightness_deep = /** @type {(inputs: Palette_Lightness_DeepInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Deep`)
};

const ko_palette_lightness_deep = /** @type {(inputs: Palette_Lightness_DeepInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`깊게`)
};

/**
* | output |
* | --- |
* | "Deep" |
*
* @param {Palette_Lightness_DeepInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const palette_lightness_deep = /** @type {((inputs?: Palette_Lightness_DeepInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Palette_Lightness_DeepInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_palette_lightness_deep(inputs)
	return ko_palette_lightness_deep(inputs)
});