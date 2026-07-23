/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Admin_Users_BalanceInputs */

const en_admin_users_balance = /** @type {(inputs: Admin_Users_BalanceInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Stardust`)
};

const ko_admin_users_balance = /** @type {(inputs: Admin_Users_BalanceInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`별가루`)
};

/**
* | output |
* | --- |
* | "Stardust" |
*
* @param {Admin_Users_BalanceInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const admin_users_balance = /** @type {((inputs?: Admin_Users_BalanceInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Admin_Users_BalanceInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_admin_users_balance(inputs)
	return ko_admin_users_balance(inputs)
});