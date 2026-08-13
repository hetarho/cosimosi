/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Star_Meta_Hint_StrengthInputs */

const en_star_meta_hint_strength = /** @type {(inputs: Star_Meta_Hint_StrengthInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`How firmly the memory has settled. Every recall raises it, and the higher it is the larger the star appears in the sky and the more slowly its brightness falls.`)
};

const ko_star_meta_hint_strength = /** @type {(inputs: Star_Meta_Hint_StrengthInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`기억이 얼마나 단단히 자리 잡았는지예요. 회고할수록 올라가고, 높을수록 하늘에서 별이 크게 보이고 밝기도 더 천천히 낮아져요.`)
};

/**
* | output |
* | --- |
* | "How firmly the memory has settled. Every recall raises it, and the higher it is the larger the star appears in the sky and the more slowly its brightness falls." |
*
* @param {Star_Meta_Hint_StrengthInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const star_meta_hint_strength = /** @type {((inputs?: Star_Meta_Hint_StrengthInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Star_Meta_Hint_StrengthInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_star_meta_hint_strength(inputs)
	return ko_star_meta_hint_strength(inputs)
});