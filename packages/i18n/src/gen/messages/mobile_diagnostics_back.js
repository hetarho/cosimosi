/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Mobile_Diagnostics_BackInputs */

const en_mobile_diagnostics_back = /** @type {(inputs: Mobile_Diagnostics_BackInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Back to shell`)
};

const ko_mobile_diagnostics_back = /** @type {(inputs: Mobile_Diagnostics_BackInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`셸로 돌아가기`)
};

/**
* | output |
* | --- |
* | "Back to shell" |
*
* @param {Mobile_Diagnostics_BackInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const mobile_diagnostics_back = /** @type {((inputs?: Mobile_Diagnostics_BackInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Mobile_Diagnostics_BackInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_mobile_diagnostics_back(inputs)
	return ko_mobile_diagnostics_back(inputs)
});