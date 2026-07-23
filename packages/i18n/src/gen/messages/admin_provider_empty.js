/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Admin_Provider_EmptyInputs */

const en_admin_provider_empty = /** @type {(inputs: Admin_Provider_EmptyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`No providers to show.`)
};

const ko_admin_provider_empty = /** @type {(inputs: Admin_Provider_EmptyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`표시할 공급자가 없어요.`)
};

/**
* | output |
* | --- |
* | "No providers to show." |
*
* @param {Admin_Provider_EmptyInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const admin_provider_empty = /** @type {((inputs?: Admin_Provider_EmptyInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Admin_Provider_EmptyInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_admin_provider_empty(inputs)
	return ko_admin_provider_empty(inputs)
});