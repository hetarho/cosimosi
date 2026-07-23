/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Admin_Section_Provider_KeysInputs */

const en_admin_section_provider_keys = /** @type {(inputs: Admin_Section_Provider_KeysInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Provider API keys`)
};

const ko_admin_section_provider_keys = /** @type {(inputs: Admin_Section_Provider_KeysInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`공급자 API 키`)
};

/**
* | output |
* | --- |
* | "Provider API keys" |
*
* @param {Admin_Section_Provider_KeysInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const admin_section_provider_keys = /** @type {((inputs?: Admin_Section_Provider_KeysInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Admin_Section_Provider_KeysInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_admin_section_provider_keys(inputs)
	return ko_admin_section_provider_keys(inputs)
});