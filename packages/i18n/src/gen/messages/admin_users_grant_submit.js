/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Admin_Users_Grant_SubmitInputs */

const en_admin_users_grant_submit = /** @type {(inputs: Admin_Users_Grant_SubmitInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Grant`)
};

const ko_admin_users_grant_submit = /** @type {(inputs: Admin_Users_Grant_SubmitInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`증정`)
};

/**
* | output |
* | --- |
* | "Grant" |
*
* @param {Admin_Users_Grant_SubmitInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const admin_users_grant_submit = /** @type {((inputs?: Admin_Users_Grant_SubmitInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Admin_Users_Grant_SubmitInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_admin_users_grant_submit(inputs)
	return ko_admin_users_grant_submit(inputs)
});