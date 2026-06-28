/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_Capability_I18nInputs */

const en_test_harness_capability_i18n = /** @type {(inputs: Test_Harness_Capability_I18nInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`i18n`)
};

const ko_test_harness_capability_i18n = /** @type {(inputs: Test_Harness_Capability_I18nInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`i18n`)
};

/**
* | output |
* | --- |
* | "i18n" |
*
* @param {Test_Harness_Capability_I18nInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_capability_i18n = /** @type {((inputs?: Test_Harness_Capability_I18nInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_Capability_I18nInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_capability_i18n(inputs)
	return ko_test_harness_capability_i18n(inputs)
});