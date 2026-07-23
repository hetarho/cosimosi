/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Admin_Users_SignupInputs */

const en_admin_users_signup = /** @type {(inputs: Admin_Users_SignupInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Joined`)
};

const ko_admin_users_signup = /** @type {(inputs: Admin_Users_SignupInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`가입일`)
};

/**
* | output |
* | --- |
* | "Joined" |
*
* @param {Admin_Users_SignupInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const admin_users_signup = /** @type {((inputs?: Admin_Users_SignupInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Admin_Users_SignupInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_admin_users_signup(inputs)
	return ko_admin_users_signup(inputs)
});