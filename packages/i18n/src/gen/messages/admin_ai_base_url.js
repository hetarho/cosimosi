/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Admin_Ai_Base_UrlInputs */

const en_admin_ai_base_url = /** @type {(inputs: Admin_Ai_Base_UrlInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Base URL`)
};

const ko_admin_ai_base_url = /** @type {(inputs: Admin_Ai_Base_UrlInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`베이스 URL`)
};

/**
* | output |
* | --- |
* | "Base URL" |
*
* @param {Admin_Ai_Base_UrlInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const admin_ai_base_url = /** @type {((inputs?: Admin_Ai_Base_UrlInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Admin_Ai_Base_UrlInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_admin_ai_base_url(inputs)
	return ko_admin_ai_base_url(inputs)
});