/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Login_AboutInputs */

const en_login_about = /** @type {(inputs: Login_AboutInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`What is cosimosi?`)
};

const ko_login_about = /** @type {(inputs: Login_AboutInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`코시모시란?`)
};

/**
* | output |
* | --- |
* | "What is cosimosi?" |
*
* @param {Login_AboutInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const login_about = /** @type {((inputs?: Login_AboutInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Login_AboutInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_login_about(inputs)
	return ko_login_about(inputs)
});