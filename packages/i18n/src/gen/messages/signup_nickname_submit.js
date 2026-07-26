/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Signup_Nickname_SubmitInputs */

const en_signup_nickname_submit = /** @type {(inputs: Signup_Nickname_SubmitInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Enter your universe`)
};

const ko_signup_nickname_submit = /** @type {(inputs: Signup_Nickname_SubmitInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`우주로 들어가기`)
};

/**
* | output |
* | --- |
* | "Enter your universe" |
*
* @param {Signup_Nickname_SubmitInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const signup_nickname_submit = /** @type {((inputs?: Signup_Nickname_SubmitInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Signup_Nickname_SubmitInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_signup_nickname_submit(inputs)
	return ko_signup_nickname_submit(inputs)
});