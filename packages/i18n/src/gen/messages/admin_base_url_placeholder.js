/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Admin_Base_Url_PlaceholderInputs */

const en_admin_base_url_placeholder = /** @type {(inputs: Admin_Base_Url_PlaceholderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`https://… (optional)`)
};

const ko_admin_base_url_placeholder = /** @type {(inputs: Admin_Base_Url_PlaceholderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`https://… (선택)`)
};

/**
* | output |
* | --- |
* | "https://… (optional)" |
*
* @param {Admin_Base_Url_PlaceholderInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const admin_base_url_placeholder = /** @type {((inputs?: Admin_Base_Url_PlaceholderInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Admin_Base_Url_PlaceholderInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_admin_base_url_placeholder(inputs)
	return ko_admin_base_url_placeholder(inputs)
});