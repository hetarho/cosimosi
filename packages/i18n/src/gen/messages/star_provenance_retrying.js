/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Star_Provenance_RetryingInputs */

const en_star_provenance_retrying = /** @type {(inputs: Star_Provenance_RetryingInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Trying the history again…`)
};

const ko_star_provenance_retrying = /** @type {(inputs: Star_Provenance_RetryingInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`변천사를 다시 펼치는 중…`)
};

/**
* | output |
* | --- |
* | "Trying the history again…" |
*
* @param {Star_Provenance_RetryingInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const star_provenance_retrying = /** @type {((inputs?: Star_Provenance_RetryingInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Star_Provenance_RetryingInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_star_provenance_retrying(inputs)
	return ko_star_provenance_retrying(inputs)
});