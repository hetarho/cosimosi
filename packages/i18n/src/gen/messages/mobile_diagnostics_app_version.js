/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Mobile_Diagnostics_App_VersionInputs */

const en_mobile_diagnostics_app_version = /** @type {(inputs: Mobile_Diagnostics_App_VersionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`App version`)
};

const ko_mobile_diagnostics_app_version = /** @type {(inputs: Mobile_Diagnostics_App_VersionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`앱 버전`)
};

/**
* | output |
* | --- |
* | "App version" |
*
* @param {Mobile_Diagnostics_App_VersionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const mobile_diagnostics_app_version = /** @type {((inputs?: Mobile_Diagnostics_App_VersionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Mobile_Diagnostics_App_VersionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_mobile_diagnostics_app_version(inputs)
	return ko_mobile_diagnostics_app_version(inputs)
});