/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Signup_To_LoginInputs */

const en_signup_to_login = /** @type {(inputs: Signup_To_LoginInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Already have an account`)
};

const ko_signup_to_login = /** @type {(inputs: Signup_To_LoginInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`이미 계정이 있어요`)
};

/**
* | output |
* | --- |
* | "Already have an account" |
*
* @param {Signup_To_LoginInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const signup_to_login = /** @type {((inputs?: Signup_To_LoginInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Signup_To_LoginInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_signup_to_login(inputs)
	return ko_signup_to_login(inputs)
});