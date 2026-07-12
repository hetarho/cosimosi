/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Star_Meta_StrengthInputs */

const en_star_meta_strength = /** @type {(inputs: Star_Meta_StrengthInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Strength`)
};

const ko_star_meta_strength = /** @type {(inputs: Star_Meta_StrengthInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`강도`)
};

/**
* | output |
* | --- |
* | "Strength" |
*
* @param {Star_Meta_StrengthInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const star_meta_strength = /** @type {((inputs?: Star_Meta_StrengthInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Star_Meta_StrengthInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_star_meta_strength(inputs)
	return ko_star_meta_strength(inputs)
});