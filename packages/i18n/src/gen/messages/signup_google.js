/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Signup_GoogleInputs */

const en_signup_google = /** @type {(inputs: Signup_GoogleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Continue with Google`)
};

const ko_signup_google = /** @type {(inputs: Signup_GoogleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Google로 이어가기`)
};

/**
* | output |
* | --- |
* | "Continue with Google" |
*
* @param {Signup_GoogleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const signup_google = /** @type {((inputs?: Signup_GoogleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Signup_GoogleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_signup_google(inputs)
	return ko_signup_google(inputs)
});