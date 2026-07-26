/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Signup_Profile_Sign_OutInputs */

const en_signup_profile_sign_out = /** @type {(inputs: Signup_Profile_Sign_OutInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Sign out`)
};

const ko_signup_profile_sign_out = /** @type {(inputs: Signup_Profile_Sign_OutInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`로그아웃`)
};

/**
* | output |
* | --- |
* | "Sign out" |
*
* @param {Signup_Profile_Sign_OutInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const signup_profile_sign_out = /** @type {((inputs?: Signup_Profile_Sign_OutInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Signup_Profile_Sign_OutInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_signup_profile_sign_out(inputs)
	return ko_signup_profile_sign_out(inputs)
});