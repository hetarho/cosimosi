/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Login_Email_LabelInputs */

const en_login_email_label = /** @type {(inputs: Login_Email_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Email`)
};

const ko_login_email_label = /** @type {(inputs: Login_Email_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`이메일`)
};

/**
* | output |
* | --- |
* | "Email" |
*
* @param {Login_Email_LabelInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const login_email_label = /** @type {((inputs?: Login_Email_LabelInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Login_Email_LabelInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_login_email_label(inputs)
	return ko_login_email_label(inputs)
});