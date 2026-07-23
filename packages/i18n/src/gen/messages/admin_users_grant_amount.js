/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Admin_Users_Grant_AmountInputs */

const en_admin_users_grant_amount = /** @type {(inputs: Admin_Users_Grant_AmountInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Amount`)
};

const ko_admin_users_grant_amount = /** @type {(inputs: Admin_Users_Grant_AmountInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`증정 수량`)
};

/**
* | output |
* | --- |
* | "Amount" |
*
* @param {Admin_Users_Grant_AmountInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const admin_users_grant_amount = /** @type {((inputs?: Admin_Users_Grant_AmountInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Admin_Users_Grant_AmountInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_admin_users_grant_amount(inputs)
	return ko_admin_users_grant_amount(inputs)
});