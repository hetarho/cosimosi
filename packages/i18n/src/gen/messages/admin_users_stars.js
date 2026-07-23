/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Admin_Users_StarsInputs */

const en_admin_users_stars = /** @type {(inputs: Admin_Users_StarsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Stars`)
};

const ko_admin_users_stars = /** @type {(inputs: Admin_Users_StarsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`별`)
};

/**
* | output |
* | --- |
* | "Stars" |
*
* @param {Admin_Users_StarsInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const admin_users_stars = /** @type {((inputs?: Admin_Users_StarsInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Admin_Users_StarsInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_admin_users_stars(inputs)
	return ko_admin_users_stars(inputs)
});