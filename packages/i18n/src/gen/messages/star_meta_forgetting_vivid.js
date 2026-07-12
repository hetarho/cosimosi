/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Star_Meta_Forgetting_VividInputs */

const en_star_meta_forgetting_vivid = /** @type {(inputs: Star_Meta_Forgetting_VividInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Vivid`)
};

const ko_star_meta_forgetting_vivid = /** @type {(inputs: Star_Meta_Forgetting_VividInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`또렷함`)
};

/**
* | output |
* | --- |
* | "Vivid" |
*
* @param {Star_Meta_Forgetting_VividInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const star_meta_forgetting_vivid = /** @type {((inputs?: Star_Meta_Forgetting_VividInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Star_Meta_Forgetting_VividInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_star_meta_forgetting_vivid(inputs)
	return ko_star_meta_forgetting_vivid(inputs)
});