/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Signup_Password_LabelInputs */

const en_signup_password_label = /** @type {(inputs: Signup_Password_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Password`)
};

const ko_signup_password_label = /** @type {(inputs: Signup_Password_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`비밀번호`)
};

/**
* | output |
* | --- |
* | "Password" |
*
* @param {Signup_Password_LabelInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const signup_password_label = /** @type {((inputs?: Signup_Password_LabelInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Signup_Password_LabelInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_signup_password_label(inputs)
	return ko_signup_password_label(inputs)
});