/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Signup_Confirmation_BackInputs */

const en_signup_confirmation_back = /** @type {(inputs: Signup_Confirmation_BackInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Use another email`)
};

const ko_signup_confirmation_back = /** @type {(inputs: Signup_Confirmation_BackInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`다른 이메일 쓰기`)
};

/**
* | output |
* | --- |
* | "Use another email" |
*
* @param {Signup_Confirmation_BackInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const signup_confirmation_back = /** @type {((inputs?: Signup_Confirmation_BackInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Signup_Confirmation_BackInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_signup_confirmation_back(inputs)
	return ko_signup_confirmation_back(inputs)
});