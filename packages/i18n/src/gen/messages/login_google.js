/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Login_GoogleInputs */

const en_login_google = /** @type {(inputs: Login_GoogleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Enter with Google`)
};

const ko_login_google = /** @type {(inputs: Login_GoogleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Google로 들어가기`)
};

/**
* | output |
* | --- |
* | "Enter with Google" |
*
* @param {Login_GoogleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const login_google = /** @type {((inputs?: Login_GoogleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Login_GoogleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_login_google(inputs)
	return ko_login_google(inputs)
});