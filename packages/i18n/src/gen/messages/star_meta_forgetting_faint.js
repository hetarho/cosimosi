/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Star_Meta_Forgetting_FaintInputs */

const en_star_meta_forgetting_faint = /** @type {(inputs: Star_Meta_Forgetting_FaintInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Faint`)
};

const ko_star_meta_forgetting_faint = /** @type {(inputs: Star_Meta_Forgetting_FaintInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`아스라함`)
};

/**
* | output |
* | --- |
* | "Faint" |
*
* @param {Star_Meta_Forgetting_FaintInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const star_meta_forgetting_faint = /** @type {((inputs?: Star_Meta_Forgetting_FaintInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Star_Meta_Forgetting_FaintInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_star_meta_forgetting_faint(inputs)
	return ko_star_meta_forgetting_faint(inputs)
});