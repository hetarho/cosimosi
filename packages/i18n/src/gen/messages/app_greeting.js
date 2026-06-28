/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} App_GreetingInputs */

const en_app_greeting = /** @type {(inputs: App_GreetingInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`hello world`)
};

const ko_app_greeting = /** @type {(inputs: App_GreetingInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`안녕하세요`)
};

/**
* | output |
* | --- |
* | "hello world" |
*
* @param {App_GreetingInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const app_greeting = /** @type {((inputs?: App_GreetingInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<App_GreetingInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_app_greeting(inputs)
	return ko_app_greeting(inputs)
});