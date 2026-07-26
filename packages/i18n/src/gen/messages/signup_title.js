/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Signup_TitleInputs */

const en_signup_title = /** @type {(inputs: Signup_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Begin here`)
};

const ko_signup_title = /** @type {(inputs: Signup_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`여기서 시작해요`)
};

/**
* | output |
* | --- |
* | "Begin here" |
*
* @param {Signup_TitleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const signup_title = /** @type {((inputs?: Signup_TitleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Signup_TitleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_signup_title(inputs)
	return ko_signup_title(inputs)
});