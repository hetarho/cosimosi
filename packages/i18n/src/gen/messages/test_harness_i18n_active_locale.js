/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_I18n_Active_LocaleInputs */

const en_test_harness_i18n_active_locale = /** @type {(inputs: Test_Harness_I18n_Active_LocaleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Active locale`)
};

const ko_test_harness_i18n_active_locale = /** @type {(inputs: Test_Harness_I18n_Active_LocaleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Active locale`)
};

/**
* | output |
* | --- |
* | "Active locale" |
*
* @param {Test_Harness_I18n_Active_LocaleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_i18n_active_locale = /** @type {((inputs?: Test_Harness_I18n_Active_LocaleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_I18n_Active_LocaleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_i18n_active_locale(inputs)
	return ko_test_harness_i18n_active_locale(inputs)
});