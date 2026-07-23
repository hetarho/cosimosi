/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Admin_Users_RevokeInputs */

const en_admin_users_revoke = /** @type {(inputs: Admin_Users_RevokeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Remove admin`)
};

const ko_admin_users_revoke = /** @type {(inputs: Admin_Users_RevokeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`관리자 해제`)
};

/**
* | output |
* | --- |
* | "Remove admin" |
*
* @param {Admin_Users_RevokeInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const admin_users_revoke = /** @type {((inputs?: Admin_Users_RevokeInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Admin_Users_RevokeInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_admin_users_revoke(inputs)
	return ko_admin_users_revoke(inputs)
});