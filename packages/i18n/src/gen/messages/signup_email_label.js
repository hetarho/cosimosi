/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Signup_Email_LabelInputs */

const en_signup_email_label = /** @type {(inputs: Signup_Email_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Email`)
};

const ko_signup_email_label = /** @type {(inputs: Signup_Email_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`이메일`)
};

/**
* | output |
* | --- |
* | "Email" |
*
* @param {Signup_Email_LabelInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const signup_email_label = /** @type {((inputs?: Signup_Email_LabelInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Signup_Email_LabelInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_signup_email_label(inputs)
	return ko_signup_email_label(inputs)
});