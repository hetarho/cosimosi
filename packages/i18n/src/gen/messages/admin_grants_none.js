/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Admin_Grants_NoneInputs */

const en_admin_grants_none = /** @type {(inputs: Admin_Grants_NoneInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`No grants yet.`)
};

const ko_admin_grants_none = /** @type {(inputs: Admin_Grants_NoneInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`증정 내역이 없어요.`)
};

/**
* | output |
* | --- |
* | "No grants yet." |
*
* @param {Admin_Grants_NoneInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const admin_grants_none = /** @type {((inputs?: Admin_Grants_NoneInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Admin_Grants_NoneInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_admin_grants_none(inputs)
	return ko_admin_grants_none(inputs)
});