/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Star_Provenance_Source_SystemInputs */

const en_star_provenance_source_system = /** @type {(inputs: Star_Provenance_Source_SystemInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`System`)
};

const ko_star_provenance_source_system = /** @type {(inputs: Star_Provenance_Source_SystemInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`시스템`)
};

/**
* | output |
* | --- |
* | "System" |
*
* @param {Star_Provenance_Source_SystemInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const star_provenance_source_system = /** @type {((inputs?: Star_Provenance_Source_SystemInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Star_Provenance_Source_SystemInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_star_provenance_source_system(inputs)
	return ko_star_provenance_source_system(inputs)
});