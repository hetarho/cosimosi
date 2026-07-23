/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Admin_Users_DiariesInputs */

const en_admin_users_diaries = /** @type {(inputs: Admin_Users_DiariesInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Diaries`)
};

const ko_admin_users_diaries = /** @type {(inputs: Admin_Users_DiariesInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`일기`)
};

/**
* | output |
* | --- |
* | "Diaries" |
*
* @param {Admin_Users_DiariesInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const admin_users_diaries = /** @type {((inputs?: Admin_Users_DiariesInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Admin_Users_DiariesInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_admin_users_diaries(inputs)
	return ko_admin_users_diaries(inputs)
});