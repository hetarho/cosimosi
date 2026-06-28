/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_Missing_CapabilitiesInputs */

const en_test_harness_missing_capabilities = /** @type {(inputs: Test_Harness_Missing_CapabilitiesInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Missing capabilities`)
};

const ko_test_harness_missing_capabilities = /** @type {(inputs: Test_Harness_Missing_CapabilitiesInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`누락된 capability`)
};

/**
* | output |
* | --- |
* | "Missing capabilities" |
*
* @param {Test_Harness_Missing_CapabilitiesInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_missing_capabilities = /** @type {((inputs?: Test_Harness_Missing_CapabilitiesInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_Missing_CapabilitiesInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_missing_capabilities(inputs)
	return ko_test_harness_missing_capabilities(inputs)
});