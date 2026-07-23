/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Admin_Model_Provider_PlaceholderInputs */

const en_admin_model_provider_placeholder = /** @type {(inputs: Admin_Model_Provider_PlaceholderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Select a provider`)
};

const ko_admin_model_provider_placeholder = /** @type {(inputs: Admin_Model_Provider_PlaceholderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`공급자 선택`)
};

/**
* | output |
* | --- |
* | "Select a provider" |
*
* @param {Admin_Model_Provider_PlaceholderInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const admin_model_provider_placeholder = /** @type {((inputs?: Admin_Model_Provider_PlaceholderInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Admin_Model_Provider_PlaceholderInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_admin_model_provider_placeholder(inputs)
	return ko_admin_model_provider_placeholder(inputs)
});