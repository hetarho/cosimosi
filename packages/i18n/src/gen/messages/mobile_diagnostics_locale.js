/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Mobile_Diagnostics_LocaleInputs */

const en_mobile_diagnostics_locale = /** @type {(inputs: Mobile_Diagnostics_LocaleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Locale`)
};

const ko_mobile_diagnostics_locale = /** @type {(inputs: Mobile_Diagnostics_LocaleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`로캘`)
};

/**
* | output |
* | --- |
* | "Locale" |
*
* @param {Mobile_Diagnostics_LocaleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const mobile_diagnostics_locale = /** @type {((inputs?: Mobile_Diagnostics_LocaleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Mobile_Diagnostics_LocaleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_mobile_diagnostics_locale(inputs)
	return ko_mobile_diagnostics_locale(inputs)
});