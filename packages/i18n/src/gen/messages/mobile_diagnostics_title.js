/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Mobile_Diagnostics_TitleInputs */

const en_mobile_diagnostics_title = /** @type {(inputs: Mobile_Diagnostics_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Diagnostics`)
};

const ko_mobile_diagnostics_title = /** @type {(inputs: Mobile_Diagnostics_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`진단`)
};

/**
* | output |
* | --- |
* | "Diagnostics" |
*
* @param {Mobile_Diagnostics_TitleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const mobile_diagnostics_title = /** @type {((inputs?: Mobile_Diagnostics_TitleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Mobile_Diagnostics_TitleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_mobile_diagnostics_title(inputs)
	return ko_mobile_diagnostics_title(inputs)
});