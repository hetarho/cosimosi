/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Landing_WordmarkInputs */

const en_landing_wordmark = /** @type {(inputs: Landing_WordmarkInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`cosimosi`)
};

const ko_landing_wordmark = /** @type {(inputs: Landing_WordmarkInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`cosimosi`)
};

/**
* | output |
* | --- |
* | "cosimosi" |
*
* @param {Landing_WordmarkInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const landing_wordmark = /** @type {((inputs?: Landing_WordmarkInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Landing_WordmarkInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_landing_wordmark(inputs)
	return ko_landing_wordmark(inputs)
});