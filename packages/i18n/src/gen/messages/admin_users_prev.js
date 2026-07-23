/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Admin_Users_PrevInputs */

const en_admin_users_prev = /** @type {(inputs: Admin_Users_PrevInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Prev`)
};

const ko_admin_users_prev = /** @type {(inputs: Admin_Users_PrevInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`이전`)
};

/**
* | output |
* | --- |
* | "Prev" |
*
* @param {Admin_Users_PrevInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const admin_users_prev = /** @type {((inputs?: Admin_Users_PrevInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Admin_Users_PrevInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_admin_users_prev(inputs)
	return ko_admin_users_prev(inputs)
});