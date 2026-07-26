/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Signup_Profile_RefusedInputs */

const en_signup_profile_refused = /** @type {(inputs: Signup_Profile_RefusedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`The way in couldn't be opened.`)
};

const ko_signup_profile_refused = /** @type {(inputs: Signup_Profile_RefusedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`들어가는 길을 열지 못했어요.`)
};

/**
* | output |
* | --- |
* | "The way in couldn't be opened." |
*
* @param {Signup_Profile_RefusedInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const signup_profile_refused = /** @type {((inputs?: Signup_Profile_RefusedInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Signup_Profile_RefusedInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_signup_profile_refused(inputs)
	return ko_signup_profile_refused(inputs)
});