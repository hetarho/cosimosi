/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Star_Provenance_ErrorInputs */

const en_star_provenance_error = /** @type {(inputs: Star_Provenance_ErrorInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Unable to open the history.`)
};

const ko_star_provenance_error = /** @type {(inputs: Star_Provenance_ErrorInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`변천사를 펼치지 못했어요.`)
};

/**
* | output |
* | --- |
* | "Unable to open the history." |
*
* @param {Star_Provenance_ErrorInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const star_provenance_error = /** @type {((inputs?: Star_Provenance_ErrorInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Star_Provenance_ErrorInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_star_provenance_error(inputs)
	return ko_star_provenance_error(inputs)
});