/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Login_Google_OnlyInputs */

const en_login_google_only = /** @type {(inputs: Login_Google_OnlyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`For now, Google is the only way in.`)
};

const ko_login_google_only = /** @type {(inputs: Login_Google_OnlyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`지금은 Google 계정으로만 들어올 수 있어요.`)
};

/**
* | output |
* | --- |
* | "For now, Google is the only way in." |
*
* @param {Login_Google_OnlyInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const login_google_only = /** @type {((inputs?: Login_Google_OnlyInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Login_Google_OnlyInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_login_google_only(inputs)
	return ko_login_google_only(inputs)
});