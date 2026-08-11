/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Landing_Sign_InInputs */

const en_landing_sign_in = /** @type {(inputs: Landing_Sign_InInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Sign in`)
};

const ko_landing_sign_in = /** @type {(inputs: Landing_Sign_InInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`로그인`)
};

/**
* | output |
* | --- |
* | "Sign in" |
*
* @param {Landing_Sign_InInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const landing_sign_in = /** @type {((inputs?: Landing_Sign_InInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Landing_Sign_InInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_landing_sign_in(inputs)
	return ko_landing_sign_in(inputs)
});