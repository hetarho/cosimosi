/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Demo_Signup_ActionInputs */

const en_demo_signup_action = /** @type {(inputs: Demo_Signup_ActionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Start my own`)
};

const ko_demo_signup_action = /** @type {(inputs: Demo_Signup_ActionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`내 우주 시작하기`)
};

/**
* | output |
* | --- |
* | "Start my own" |
*
* @param {Demo_Signup_ActionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const demo_signup_action = /** @type {((inputs?: Demo_Signup_ActionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Demo_Signup_ActionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_demo_signup_action(inputs)
	return ko_demo_signup_action(inputs)
});