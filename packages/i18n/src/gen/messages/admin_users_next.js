/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Admin_Users_NextInputs */

const en_admin_users_next = /** @type {(inputs: Admin_Users_NextInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Next`)
};

const ko_admin_users_next = /** @type {(inputs: Admin_Users_NextInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`다음`)
};

/**
* | output |
* | --- |
* | "Next" |
*
* @param {Admin_Users_NextInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const admin_users_next = /** @type {((inputs?: Admin_Users_NextInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Admin_Users_NextInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_admin_users_next(inputs)
	return ko_admin_users_next(inputs)
});