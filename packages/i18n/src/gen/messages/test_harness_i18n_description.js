/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_I18n_DescriptionInputs */

const en_test_harness_i18n_description = /** @type {(inputs: Test_Harness_I18n_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Switches the active Paraglide locale and verifies panel copy updates.`)
};

const ko_test_harness_i18n_description = /** @type {(inputs: Test_Harness_I18n_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`활성 Paraglide locale을 바꾸고 패널 copy가 갱신되는지 확인합니다.`)
};

/**
* | output |
* | --- |
* | "Switches the active Paraglide locale and verifies panel copy updates." |
*
* @param {Test_Harness_I18n_DescriptionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_i18n_description = /** @type {((inputs?: Test_Harness_I18n_DescriptionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_I18n_DescriptionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_i18n_description(inputs)
	return ko_test_harness_i18n_description(inputs)
});