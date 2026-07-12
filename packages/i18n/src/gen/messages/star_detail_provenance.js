/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Star_Detail_ProvenanceInputs */

const en_star_detail_provenance = /** @type {(inputs: Star_Detail_ProvenanceInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`View history`)
};

const ko_star_detail_provenance = /** @type {(inputs: Star_Detail_ProvenanceInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`변천사 보기`)
};

/**
* | output |
* | --- |
* | "View history" |
*
* @param {Star_Detail_ProvenanceInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const star_detail_provenance = /** @type {((inputs?: Star_Detail_ProvenanceInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Star_Detail_ProvenanceInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_star_detail_provenance(inputs)
	return ko_star_detail_provenance(inputs)
});