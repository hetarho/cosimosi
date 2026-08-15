/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ max: NonNullable<unknown> }} Admin_Users_Grant_Amount_InvalidInputs */

const en_admin_users_grant_amount_invalid = /** @type {(inputs: Admin_Users_Grant_Amount_InvalidInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`Enter a whole number from 1 to ${i?.max}.`)
};

const ko_admin_users_grant_amount_invalid = /** @type {(inputs: Admin_Users_Grant_Amount_InvalidInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`1부터 ${i?.max}까지의 정수를 입력해 주세요.`)
};

/**
* | output |
* | --- |
* | "Enter a whole number from 1 to {max}." |
*
* @param {Admin_Users_Grant_Amount_InvalidInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const admin_users_grant_amount_invalid = /** @type {((inputs: Admin_Users_Grant_Amount_InvalidInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Admin_Users_Grant_Amount_InvalidInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_admin_users_grant_amount_invalid(inputs)
	return ko_admin_users_grant_amount_invalid(inputs)
});