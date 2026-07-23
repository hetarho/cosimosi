/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Admin_Users_GrantInputs */

const en_admin_users_grant = /** @type {(inputs: Admin_Users_GrantInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Grant stardust`)
};

const ko_admin_users_grant = /** @type {(inputs: Admin_Users_GrantInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`별가루 증정`)
};

/**
* | output |
* | --- |
* | "Grant stardust" |
*
* @param {Admin_Users_GrantInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const admin_users_grant = /** @type {((inputs?: Admin_Users_GrantInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Admin_Users_GrantInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_admin_users_grant(inputs)
	return ko_admin_users_grant(inputs)
});