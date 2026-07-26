/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Signup_SubmitInputs */

const en_signup_submit = /** @type {(inputs: Signup_SubmitInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Create account`)
};

const ko_signup_submit = /** @type {(inputs: Signup_SubmitInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`계정 만들기`)
};

/**
* | output |
* | --- |
* | "Create account" |
*
* @param {Signup_SubmitInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const signup_submit = /** @type {((inputs?: Signup_SubmitInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Signup_SubmitInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_signup_submit(inputs)
	return ko_signup_submit(inputs)
});