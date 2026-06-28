/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_I18n_TitleInputs */

const en_test_harness_i18n_title = /** @type {(inputs: Test_Harness_I18n_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`i18n locale`)
};

const ko_test_harness_i18n_title = /** @type {(inputs: Test_Harness_I18n_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`i18n locale`)
};

/**
* | output |
* | --- |
* | "i18n locale" |
*
* @param {Test_Harness_I18n_TitleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_i18n_title = /** @type {((inputs?: Test_Harness_I18n_TitleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_I18n_TitleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_i18n_title(inputs)
	return ko_test_harness_i18n_title(inputs)
});