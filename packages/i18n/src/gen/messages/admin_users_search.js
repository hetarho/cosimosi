/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Admin_Users_SearchInputs */

const en_admin_users_search = /** @type {(inputs: Admin_Users_SearchInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Search email or ID`)
};

const ko_admin_users_search = /** @type {(inputs: Admin_Users_SearchInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`이메일 또는 ID 검색`)
};

/**
* | output |
* | --- |
* | "Search email or ID" |
*
* @param {Admin_Users_SearchInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const admin_users_search = /** @type {((inputs?: Admin_Users_SearchInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Admin_Users_SearchInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_admin_users_search(inputs)
	return ko_admin_users_search(inputs)
});