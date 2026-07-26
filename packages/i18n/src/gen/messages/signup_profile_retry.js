/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Signup_Profile_RetryInputs */

const en_signup_profile_retry = /** @type {(inputs: Signup_Profile_RetryInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Try the way in again`)
};

const ko_signup_profile_retry = /** @type {(inputs: Signup_Profile_RetryInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`들어가는 길 다시 열기`)
};

/**
* | output |
* | --- |
* | "Try the way in again" |
*
* @param {Signup_Profile_RetryInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const signup_profile_retry = /** @type {((inputs?: Signup_Profile_RetryInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Signup_Profile_RetryInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_signup_profile_retry(inputs)
	return ko_signup_profile_retry(inputs)
});