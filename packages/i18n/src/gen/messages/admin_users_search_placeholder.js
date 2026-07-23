/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Admin_Users_Search_PlaceholderInputs */

const en_admin_users_search_placeholder = /** @type {(inputs: Admin_Users_Search_PlaceholderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`email or id`)
};

const ko_admin_users_search_placeholder = /** @type {(inputs: Admin_Users_Search_PlaceholderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`이메일 또는 ID`)
};

/**
* | output |
* | --- |
* | "email or id" |
*
* @param {Admin_Users_Search_PlaceholderInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const admin_users_search_placeholder = /** @type {((inputs?: Admin_Users_Search_PlaceholderInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Admin_Users_Search_PlaceholderInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_admin_users_search_placeholder(inputs)
	return ko_admin_users_search_placeholder(inputs)
});