/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Palette_Recommendation_LabelInputs */

const en_palette_recommendation_label = /** @type {(inputs: Palette_Recommendation_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Choose this color`)
};

const ko_palette_recommendation_label = /** @type {(inputs: Palette_Recommendation_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`이 색을 고르기`)
};

/**
* | output |
* | --- |
* | "Choose this color" |
*
* @param {Palette_Recommendation_LabelInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const palette_recommendation_label = /** @type {((inputs?: Palette_Recommendation_LabelInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Palette_Recommendation_LabelInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_palette_recommendation_label(inputs)
	return ko_palette_recommendation_label(inputs)
});