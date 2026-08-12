/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Login_Try_DemoInputs */

const en_login_try_demo = /** @type {(inputs: Login_Try_DemoInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Try the universe`)
};

const ko_login_try_demo = /** @type {(inputs: Login_Try_DemoInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`우주 체험해보기`)
};

/**
* | output |
* | --- |
* | "Try the universe" |
*
* @param {Login_Try_DemoInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const login_try_demo = /** @type {((inputs?: Login_Try_DemoInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Login_Try_DemoInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_login_try_demo(inputs)
	return ko_login_try_demo(inputs)
});