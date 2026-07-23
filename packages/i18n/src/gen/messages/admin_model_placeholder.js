/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Admin_Model_PlaceholderInputs */

const en_admin_model_placeholder = /** @type {(inputs: Admin_Model_PlaceholderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`e.g. claude-opus-4-8`)
};

const ko_admin_model_placeholder = /** @type {(inputs: Admin_Model_PlaceholderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`예: claude-opus-4-8`)
};

/**
* | output |
* | --- |
* | "e.g. claude-opus-4-8" |
*
* @param {Admin_Model_PlaceholderInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const admin_model_placeholder = /** @type {((inputs?: Admin_Model_PlaceholderInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Admin_Model_PlaceholderInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_admin_model_placeholder(inputs)
	return ko_admin_model_placeholder(inputs)
});