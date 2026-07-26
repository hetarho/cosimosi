/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Signup_FailedInputs */

const en_signup_failed = /** @type {(inputs: Signup_FailedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`The account couldn't be created. Try again.`)
};

const ko_signup_failed = /** @type {(inputs: Signup_FailedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`계정을 만들지 못했어요. 다시 시도해 주세요.`)
};

/**
* | output |
* | --- |
* | "The account couldn't be created. Try again." |
*
* @param {Signup_FailedInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const signup_failed = /** @type {((inputs?: Signup_FailedInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Signup_FailedInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_signup_failed(inputs)
	return ko_signup_failed(inputs)
});