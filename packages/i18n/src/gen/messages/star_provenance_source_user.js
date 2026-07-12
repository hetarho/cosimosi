/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Star_Provenance_Source_UserInputs */

const en_star_provenance_source_user = /** @type {(inputs: Star_Provenance_Source_UserInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`You`)
};

const ko_star_provenance_source_user = /** @type {(inputs: Star_Provenance_Source_UserInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`사용자`)
};

/**
* | output |
* | --- |
* | "You" |
*
* @param {Star_Provenance_Source_UserInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const star_provenance_source_user = /** @type {((inputs?: Star_Provenance_Source_UserInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Star_Provenance_Source_UserInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_star_provenance_source_user(inputs)
	return ko_star_provenance_source_user(inputs)
});