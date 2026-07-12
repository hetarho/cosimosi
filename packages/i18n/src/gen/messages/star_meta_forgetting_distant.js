/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Star_Meta_Forgetting_DistantInputs */

const en_star_meta_forgetting_distant = /** @type {(inputs: Star_Meta_Forgetting_DistantInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Distant`)
};

const ko_star_meta_forgetting_distant = /** @type {(inputs: Star_Meta_Forgetting_DistantInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`멀어짐`)
};

/**
* | output |
* | --- |
* | "Distant" |
*
* @param {Star_Meta_Forgetting_DistantInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const star_meta_forgetting_distant = /** @type {((inputs?: Star_Meta_Forgetting_DistantInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Star_Meta_Forgetting_DistantInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_star_meta_forgetting_distant(inputs)
	return ko_star_meta_forgetting_distant(inputs)
});