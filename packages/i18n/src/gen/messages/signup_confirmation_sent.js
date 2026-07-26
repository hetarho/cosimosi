/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Signup_Confirmation_SentInputs */

const en_signup_confirmation_sent = /** @type {(inputs: Signup_Confirmation_SentInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`A confirmation link is waiting in your email.`)
};

const ko_signup_confirmation_sent = /** @type {(inputs: Signup_Confirmation_SentInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`확인 링크를 이메일로 보냈어요.`)
};

/**
* | output |
* | --- |
* | "A confirmation link is waiting in your email." |
*
* @param {Signup_Confirmation_SentInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const signup_confirmation_sent = /** @type {((inputs?: Signup_Confirmation_SentInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Signup_Confirmation_SentInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_signup_confirmation_sent(inputs)
	return ko_signup_confirmation_sent(inputs)
});