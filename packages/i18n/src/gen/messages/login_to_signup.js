/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Login_To_SignupInputs */

const en_login_to_signup = /** @type {(inputs: Login_To_SignupInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Create an account`)
};

const ko_login_to_signup = /** @type {(inputs: Login_To_SignupInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`계정 만들기`)
};

/**
* | output |
* | --- |
* | "Create an account" |
*
* @param {Login_To_SignupInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const login_to_signup = /** @type {((inputs?: Login_To_SignupInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Login_To_SignupInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_login_to_signup(inputs)
	return ko_login_to_signup(inputs)
});