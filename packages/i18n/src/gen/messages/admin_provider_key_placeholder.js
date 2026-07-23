/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Admin_Provider_Key_PlaceholderInputs */

const en_admin_provider_key_placeholder = /** @type {(inputs: Admin_Provider_Key_PlaceholderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Enter new API key`)
};

const ko_admin_provider_key_placeholder = /** @type {(inputs: Admin_Provider_Key_PlaceholderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`새 API 키 입력`)
};

/**
* | output |
* | --- |
* | "Enter new API key" |
*
* @param {Admin_Provider_Key_PlaceholderInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const admin_provider_key_placeholder = /** @type {((inputs?: Admin_Provider_Key_PlaceholderInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Admin_Provider_Key_PlaceholderInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_admin_provider_key_placeholder(inputs)
	return ko_admin_provider_key_placeholder(inputs)
});