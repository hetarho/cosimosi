/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Star_Provenance_Kind_ReconsolidatedInputs */

const en_star_provenance_kind_reconsolidated = /** @type {(inputs: Star_Provenance_Kind_ReconsolidatedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Reconsolidated`)
};

const ko_star_provenance_kind_reconsolidated = /** @type {(inputs: Star_Provenance_Kind_ReconsolidatedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`재공고화`)
};

/**
* | output |
* | --- |
* | "Reconsolidated" |
*
* @param {Star_Provenance_Kind_ReconsolidatedInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const star_provenance_kind_reconsolidated = /** @type {((inputs?: Star_Provenance_Kind_ReconsolidatedInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Star_Provenance_Kind_ReconsolidatedInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_star_provenance_kind_reconsolidated(inputs)
	return ko_star_provenance_kind_reconsolidated(inputs)
});