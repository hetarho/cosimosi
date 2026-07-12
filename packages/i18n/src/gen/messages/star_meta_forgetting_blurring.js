/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Star_Meta_Forgetting_BlurringInputs */

const en_star_meta_forgetting_blurring = /** @type {(inputs: Star_Meta_Forgetting_BlurringInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Blurring`)
};

const ko_star_meta_forgetting_blurring = /** @type {(inputs: Star_Meta_Forgetting_BlurringInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`흐려짐`)
};

/**
* | output |
* | --- |
* | "Blurring" |
*
* @param {Star_Meta_Forgetting_BlurringInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const star_meta_forgetting_blurring = /** @type {((inputs?: Star_Meta_Forgetting_BlurringInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Star_Meta_Forgetting_BlurringInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_star_meta_forgetting_blurring(inputs)
	return ko_star_meta_forgetting_blurring(inputs)
});