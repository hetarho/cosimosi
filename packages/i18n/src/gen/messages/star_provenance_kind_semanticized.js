/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Star_Provenance_Kind_SemanticizedInputs */

const en_star_provenance_kind_semanticized = /** @type {(inputs: Star_Provenance_Kind_SemanticizedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Gisted`)
};

const ko_star_provenance_kind_semanticized = /** @type {(inputs: Star_Provenance_Kind_SemanticizedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`요지화`)
};

/**
* | output |
* | --- |
* | "Gisted" |
*
* @param {Star_Provenance_Kind_SemanticizedInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const star_provenance_kind_semanticized = /** @type {((inputs?: Star_Provenance_Kind_SemanticizedInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Star_Provenance_Kind_SemanticizedInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_star_provenance_kind_semanticized(inputs)
	return ko_star_provenance_kind_semanticized(inputs)
});