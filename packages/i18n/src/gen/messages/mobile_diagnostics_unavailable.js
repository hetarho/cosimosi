/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Mobile_Diagnostics_UnavailableInputs */

const en_mobile_diagnostics_unavailable = /** @type {(inputs: Mobile_Diagnostics_UnavailableInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Diagnostics are disabled by the platform diagnostics surface flag.`)
};

const ko_mobile_diagnostics_unavailable = /** @type {(inputs: Mobile_Diagnostics_UnavailableInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`platform diagnostics surface 플래그로 진단이 비활성화되어 있습니다.`)
};

/**
* | output |
* | --- |
* | "Diagnostics are disabled by the platform diagnostics surface flag." |
*
* @param {Mobile_Diagnostics_UnavailableInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const mobile_diagnostics_unavailable = /** @type {((inputs?: Mobile_Diagnostics_UnavailableInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Mobile_Diagnostics_UnavailableInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_mobile_diagnostics_unavailable(inputs)
	return ko_mobile_diagnostics_unavailable(inputs)
});