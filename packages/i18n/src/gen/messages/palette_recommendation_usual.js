/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Palette_Recommendation_UsualInputs */

const en_palette_recommendation_usual = /** @type {(inputs: Palette_Recommendation_UsualInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`A familiar color`)
};

const ko_palette_recommendation_usual = /** @type {(inputs: Palette_Recommendation_UsualInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`자주 불리는 색`)
};

/**
* | output |
* | --- |
* | "A familiar color" |
*
* @param {Palette_Recommendation_UsualInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const palette_recommendation_usual = /** @type {((inputs?: Palette_Recommendation_UsualInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Palette_Recommendation_UsualInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_palette_recommendation_usual(inputs)
	return ko_palette_recommendation_usual(inputs)
});