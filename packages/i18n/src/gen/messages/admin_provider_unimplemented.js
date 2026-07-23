/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Admin_Provider_UnimplementedInputs */

const en_admin_provider_unimplemented = /** @type {(inputs: Admin_Provider_UnimplementedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`adapter not ready`)
};

const ko_admin_provider_unimplemented = /** @type {(inputs: Admin_Provider_UnimplementedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`어댑터 준비 중`)
};

/**
* | output |
* | --- |
* | "adapter not ready" |
*
* @param {Admin_Provider_UnimplementedInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const admin_provider_unimplemented = /** @type {((inputs?: Admin_Provider_UnimplementedInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Admin_Provider_UnimplementedInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_admin_provider_unimplemented(inputs)
	return ko_admin_provider_unimplemented(inputs)
});