/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Admin_Users_EmptyInputs */

const en_admin_users_empty = /** @type {(inputs: Admin_Users_EmptyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`No users to show.`)
};

const ko_admin_users_empty = /** @type {(inputs: Admin_Users_EmptyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`표시할 사용자가 없어요.`)
};

/**
* | output |
* | --- |
* | "No users to show." |
*
* @param {Admin_Users_EmptyInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const admin_users_empty = /** @type {((inputs?: Admin_Users_EmptyInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Admin_Users_EmptyInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_admin_users_empty(inputs)
	return ko_admin_users_empty(inputs)
});