/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Admin_Usage_CapInputs */

const en_admin_usage_cap = /** @type {(inputs: Admin_Usage_CapInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Daily cap`)
};

const ko_admin_usage_cap = /** @type {(inputs: Admin_Usage_CapInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`일일 한도`)
};

/**
* | output |
* | --- |
* | "Daily cap" |
*
* @param {Admin_Usage_CapInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const admin_usage_cap = /** @type {((inputs?: Admin_Usage_CapInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Admin_Usage_CapInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_admin_usage_cap(inputs)
	return ko_admin_usage_cap(inputs)
});