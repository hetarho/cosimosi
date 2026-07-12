/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Star_Meta_Forgetting_StateInputs */

const en_star_meta_forgetting_state = /** @type {(inputs: Star_Meta_Forgetting_StateInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Current state`)
};

const ko_star_meta_forgetting_state = /** @type {(inputs: Star_Meta_Forgetting_StateInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`지금 상태`)
};

/**
* | output |
* | --- |
* | "Current state" |
*
* @param {Star_Meta_Forgetting_StateInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const star_meta_forgetting_state = /** @type {((inputs?: Star_Meta_Forgetting_StateInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Star_Meta_Forgetting_StateInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_star_meta_forgetting_state(inputs)
	return ko_star_meta_forgetting_state(inputs)
});