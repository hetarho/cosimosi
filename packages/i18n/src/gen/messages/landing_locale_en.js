/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Landing_Locale_EnInputs */

const en_landing_locale_en = /** @type {(inputs: Landing_Locale_EnInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`EN`)
};

const ko_landing_locale_en = /** @type {(inputs: Landing_Locale_EnInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`EN`)
};

/**
* | output |
* | --- |
* | "EN" |
*
* @param {Landing_Locale_EnInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const landing_locale_en = /** @type {((inputs?: Landing_Locale_EnInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Landing_Locale_EnInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_landing_locale_en(inputs)
	return ko_landing_locale_en(inputs)
});