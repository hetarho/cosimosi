/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Login_Google_FailedInputs */

const en_login_google_failed = /** @type {(inputs: Login_Google_FailedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Couldn't sign in with Google. Try again.`)
};

const ko_login_google_failed = /** @type {(inputs: Login_Google_FailedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Google로는 들어가지 못했어요. 다시 시도해 주세요.`)
};

/**
* | output |
* | --- |
* | "Couldn't sign in with Google. Try again." |
*
* @param {Login_Google_FailedInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const login_google_failed = /** @type {((inputs?: Login_Google_FailedInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Login_Google_FailedInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_login_google_failed(inputs)
	return ko_login_google_failed(inputs)
});