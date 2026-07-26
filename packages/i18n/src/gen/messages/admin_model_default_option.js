/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Admin_Model_Default_OptionInputs */

const en_admin_model_default_option = /** @type {(inputs: Admin_Model_Default_OptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Provider default`)
};

const ko_admin_model_default_option = /** @type {(inputs: Admin_Model_Default_OptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`공급자 기본 모델`)
};

/**
* | output |
* | --- |
* | "Provider default" |
*
* @param {Admin_Model_Default_OptionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const admin_model_default_option = /** @type {((inputs?: Admin_Model_Default_OptionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Admin_Model_Default_OptionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_admin_model_default_option(inputs)
	return ko_admin_model_default_option(inputs)
});