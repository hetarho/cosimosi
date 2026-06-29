/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Mobile_Diagnostics_ThemeInputs */

const en_mobile_diagnostics_theme = /** @type {(inputs: Mobile_Diagnostics_ThemeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Theme`)
};

const ko_mobile_diagnostics_theme = /** @type {(inputs: Mobile_Diagnostics_ThemeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`테마`)
};

/**
* | output |
* | --- |
* | "Theme" |
*
* @param {Mobile_Diagnostics_ThemeInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const mobile_diagnostics_theme = /** @type {((inputs?: Mobile_Diagnostics_ThemeInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Mobile_Diagnostics_ThemeInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_mobile_diagnostics_theme(inputs)
	return ko_mobile_diagnostics_theme(inputs)
});