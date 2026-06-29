/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Mobile_Diagnostics_FlagsInputs */

const en_mobile_diagnostics_flags = /** @type {(inputs: Mobile_Diagnostics_FlagsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Feature flag defaults`)
};

const ko_mobile_diagnostics_flags = /** @type {(inputs: Mobile_Diagnostics_FlagsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`기능 플래그 기본값`)
};

/**
* | output |
* | --- |
* | "Feature flag defaults" |
*
* @param {Mobile_Diagnostics_FlagsInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const mobile_diagnostics_flags = /** @type {((inputs?: Mobile_Diagnostics_FlagsInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Mobile_Diagnostics_FlagsInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_mobile_diagnostics_flags(inputs)
	return ko_mobile_diagnostics_flags(inputs)
});