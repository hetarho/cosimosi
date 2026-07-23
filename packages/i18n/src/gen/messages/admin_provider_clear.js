/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Admin_Provider_ClearInputs */

const en_admin_provider_clear = /** @type {(inputs: Admin_Provider_ClearInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Clear key`)
};

const ko_admin_provider_clear = /** @type {(inputs: Admin_Provider_ClearInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`키 삭제`)
};

/**
* | output |
* | --- |
* | "Clear key" |
*
* @param {Admin_Provider_ClearInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const admin_provider_clear = /** @type {((inputs?: Admin_Provider_ClearInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Admin_Provider_ClearInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_admin_provider_clear(inputs)
	return ko_admin_provider_clear(inputs)
});