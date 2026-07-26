/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Signup_Nickname_TitleInputs */

const en_signup_nickname_title = /** @type {(inputs: Signup_Nickname_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`A name for this universe`)
};

const ko_signup_nickname_title = /** @type {(inputs: Signup_Nickname_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`이 우주에서 불릴 이름`)
};

/**
* | output |
* | --- |
* | "A name for this universe" |
*
* @param {Signup_Nickname_TitleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const signup_nickname_title = /** @type {((inputs?: Signup_Nickname_TitleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Signup_Nickname_TitleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_signup_nickname_title(inputs)
	return ko_signup_nickname_title(inputs)
});