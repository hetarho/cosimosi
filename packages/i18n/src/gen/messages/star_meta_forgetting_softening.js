/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Star_Meta_Forgetting_SofteningInputs */

const en_star_meta_forgetting_softening = /** @type {(inputs: Star_Meta_Forgetting_SofteningInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Softening`)
};

const ko_star_meta_forgetting_softening = /** @type {(inputs: Star_Meta_Forgetting_SofteningInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`옅어짐`)
};

/**
* | output |
* | --- |
* | "Softening" |
*
* @param {Star_Meta_Forgetting_SofteningInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const star_meta_forgetting_softening = /** @type {((inputs?: Star_Meta_Forgetting_SofteningInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Star_Meta_Forgetting_SofteningInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_star_meta_forgetting_softening(inputs)
	return ko_star_meta_forgetting_softening(inputs)
});