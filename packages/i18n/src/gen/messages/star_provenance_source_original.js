/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Star_Provenance_Source_OriginalInputs */

const en_star_provenance_source_original = /** @type {(inputs: Star_Provenance_Source_OriginalInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Original`)
};

const ko_star_provenance_source_original = /** @type {(inputs: Star_Provenance_Source_OriginalInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`원본`)
};

/**
* | output |
* | --- |
* | "Original" |
*
* @param {Star_Provenance_Source_OriginalInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const star_provenance_source_original = /** @type {((inputs?: Star_Provenance_Source_OriginalInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Star_Provenance_Source_OriginalInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_star_provenance_source_original(inputs)
	return ko_star_provenance_source_original(inputs)
});