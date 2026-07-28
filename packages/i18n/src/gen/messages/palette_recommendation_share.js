/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ percent: NonNullable<unknown> }} Palette_Recommendation_ShareInputs */

const en_palette_recommendation_share = /** @type {(inputs: Palette_Recommendation_ShareInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.percent}% chose this`)
};

const ko_palette_recommendation_share = /** @type {(inputs: Palette_Recommendation_ShareInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.percent}%가 이 색을 골랐어요`)
};

/**
* | output |
* | --- |
* | "{percent}% chose this" |
*
* @param {Palette_Recommendation_ShareInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const palette_recommendation_share = /** @type {((inputs: Palette_Recommendation_ShareInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Palette_Recommendation_ShareInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_palette_recommendation_share(inputs)
	return ko_palette_recommendation_share(inputs)
});