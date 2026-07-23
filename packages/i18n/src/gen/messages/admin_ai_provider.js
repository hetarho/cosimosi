/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Admin_Ai_ProviderInputs */

const en_admin_ai_provider = /** @type {(inputs: Admin_Ai_ProviderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Provider`)
};

const ko_admin_ai_provider = /** @type {(inputs: Admin_Ai_ProviderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`공급자`)
};

/**
* | output |
* | --- |
* | "Provider" |
*
* @param {Admin_Ai_ProviderInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const admin_ai_provider = /** @type {((inputs?: Admin_Ai_ProviderInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Admin_Ai_ProviderInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_admin_ai_provider(inputs)
	return ko_admin_ai_provider(inputs)
});