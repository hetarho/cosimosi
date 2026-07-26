/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Signup_Nickname_FailedInputs */

const en_signup_nickname_failed = /** @type {(inputs: Signup_Nickname_FailedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`That name couldn't be kept. Try again.`)
};

const ko_signup_nickname_failed = /** @type {(inputs: Signup_Nickname_FailedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`그 이름을 담지 못했어요. 다시 시도해 주세요.`)
};

/**
* | output |
* | --- |
* | "That name couldn't be kept. Try again." |
*
* @param {Signup_Nickname_FailedInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const signup_nickname_failed = /** @type {((inputs?: Signup_Nickname_FailedInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Signup_Nickname_FailedInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_signup_nickname_failed(inputs)
	return ko_signup_nickname_failed(inputs)
});