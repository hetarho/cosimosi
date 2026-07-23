/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Admin_Users_Is_AdminInputs */

const en_admin_users_is_admin = /** @type {(inputs: Admin_Users_Is_AdminInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Admin`)
};

const ko_admin_users_is_admin = /** @type {(inputs: Admin_Users_Is_AdminInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`관리자`)
};

/**
* | output |
* | --- |
* | "Admin" |
*
* @param {Admin_Users_Is_AdminInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const admin_users_is_admin = /** @type {((inputs?: Admin_Users_Is_AdminInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Admin_Users_Is_AdminInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_admin_users_is_admin(inputs)
	return ko_admin_users_is_admin(inputs)
});