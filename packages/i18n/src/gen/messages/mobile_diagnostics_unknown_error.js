/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Mobile_Diagnostics_Unknown_ErrorInputs */

const en_mobile_diagnostics_unknown_error = /** @type {(inputs: Mobile_Diagnostics_Unknown_ErrorInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Unknown error`)
};

const ko_mobile_diagnostics_unknown_error = /** @type {(inputs: Mobile_Diagnostics_Unknown_ErrorInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`알 수 없는 오류`)
};

/**
* | output |
* | --- |
* | "Unknown error" |
*
* @param {Mobile_Diagnostics_Unknown_ErrorInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const mobile_diagnostics_unknown_error = /** @type {((inputs?: Mobile_Diagnostics_Unknown_ErrorInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Mobile_Diagnostics_Unknown_ErrorInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_mobile_diagnostics_unknown_error(inputs)
	return ko_mobile_diagnostics_unknown_error(inputs)
});