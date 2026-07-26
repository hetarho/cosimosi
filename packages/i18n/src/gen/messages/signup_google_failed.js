/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Signup_Google_FailedInputs */

const en_signup_google_failed = /** @type {(inputs: Signup_Google_FailedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Couldn't continue with Google. Try again.`)
};

const ko_signup_google_failed = /** @type {(inputs: Signup_Google_FailedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Google로 이어가지 못했어요. 다시 시도해 주세요.`)
};

/**
* | output |
* | --- |
* | "Couldn't continue with Google. Try again." |
*
* @param {Signup_Google_FailedInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const signup_google_failed = /** @type {((inputs?: Signup_Google_FailedInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Signup_Google_FailedInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_signup_google_failed(inputs)
	return ko_signup_google_failed(inputs)
});