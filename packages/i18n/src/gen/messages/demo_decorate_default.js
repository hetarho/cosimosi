/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Demo_Decorate_DefaultInputs */

const en_demo_decorate_default = /** @type {(inputs: Demo_Decorate_DefaultInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Default`)
};

const ko_demo_decorate_default = /** @type {(inputs: Demo_Decorate_DefaultInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`기본`)
};

/**
* | output |
* | --- |
* | "Default" |
*
* @param {Demo_Decorate_DefaultInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const demo_decorate_default = /** @type {((inputs?: Demo_Decorate_DefaultInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Demo_Decorate_DefaultInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_demo_decorate_default(inputs)
	return ko_demo_decorate_default(inputs)
});