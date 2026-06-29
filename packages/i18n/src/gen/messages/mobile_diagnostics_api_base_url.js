/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Mobile_Diagnostics_Api_Base_UrlInputs */

const en_mobile_diagnostics_api_base_url = /** @type {(inputs: Mobile_Diagnostics_Api_Base_UrlInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`API base URL`)
};

const ko_mobile_diagnostics_api_base_url = /** @type {(inputs: Mobile_Diagnostics_Api_Base_UrlInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`API 기본 URL`)
};

/**
* | output |
* | --- |
* | "API base URL" |
*
* @param {Mobile_Diagnostics_Api_Base_UrlInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const mobile_diagnostics_api_base_url = /** @type {((inputs?: Mobile_Diagnostics_Api_Base_UrlInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Mobile_Diagnostics_Api_Base_UrlInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_mobile_diagnostics_api_base_url(inputs)
	return ko_mobile_diagnostics_api_base_url(inputs)
});