/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Admin_Model_Custom_OptionInputs */

const en_admin_model_custom_option = /** @type {(inputs: Admin_Model_Custom_OptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Enter a model id…`)
};

const ko_admin_model_custom_option = /** @type {(inputs: Admin_Model_Custom_OptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`모델 ID 직접 입력…`)
};

/**
* | output |
* | --- |
* | "Enter a model id…" |
*
* @param {Admin_Model_Custom_OptionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const admin_model_custom_option = /** @type {((inputs?: Admin_Model_Custom_OptionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Admin_Model_Custom_OptionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_admin_model_custom_option(inputs)
	return ko_admin_model_custom_option(inputs)
});