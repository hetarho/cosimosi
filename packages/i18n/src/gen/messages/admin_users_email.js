/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Admin_Users_EmailInputs */

const en_admin_users_email = /** @type {(inputs: Admin_Users_EmailInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Email`)
};

const ko_admin_users_email = /** @type {(inputs: Admin_Users_EmailInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`이메일`)
};

/**
* | output |
* | --- |
* | "Email" |
*
* @param {Admin_Users_EmailInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const admin_users_email = /** @type {((inputs?: Admin_Users_EmailInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Admin_Users_EmailInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_admin_users_email(inputs)
	return ko_admin_users_email(inputs)
});