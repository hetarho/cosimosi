/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Admin_Not_AdminInputs */

const en_admin_not_admin = /** @type {(inputs: Admin_Not_AdminInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Admins only.`)
};

const ko_admin_not_admin = /** @type {(inputs: Admin_Not_AdminInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`관리자만 접근할 수 있어요.`)
};

/**
* | output |
* | --- |
* | "Admins only." |
*
* @param {Admin_Not_AdminInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const admin_not_admin = /** @type {((inputs?: Admin_Not_AdminInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Admin_Not_AdminInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_admin_not_admin(inputs)
	return ko_admin_not_admin(inputs)
});