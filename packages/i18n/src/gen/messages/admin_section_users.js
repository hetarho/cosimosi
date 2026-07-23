/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Admin_Section_UsersInputs */

const en_admin_section_users = /** @type {(inputs: Admin_Section_UsersInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Users`)
};

const ko_admin_section_users = /** @type {(inputs: Admin_Section_UsersInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`사용자`)
};

/**
* | output |
* | --- |
* | "Users" |
*
* @param {Admin_Section_UsersInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const admin_section_users = /** @type {((inputs?: Admin_Section_UsersInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Admin_Section_UsersInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_admin_section_users(inputs)
	return ko_admin_section_users(inputs)
});