/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Admin_Users_PromoteInputs */

const en_admin_users_promote = /** @type {(inputs: Admin_Users_PromoteInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Make admin`)
};

const ko_admin_users_promote = /** @type {(inputs: Admin_Users_PromoteInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`관리자 지정`)
};

/**
* | output |
* | --- |
* | "Make admin" |
*
* @param {Admin_Users_PromoteInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const admin_users_promote = /** @type {((inputs?: Admin_Users_PromoteInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Admin_Users_PromoteInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_admin_users_promote(inputs)
	return ko_admin_users_promote(inputs)
});