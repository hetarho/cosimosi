/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_Values_Default_StaleInputs */

const en_test_harness_values_default_stale = /** @type {(inputs: Test_Harness_Values_Default_StaleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Default stale time`)
};

const ko_test_harness_values_default_stale = /** @type {(inputs: Test_Harness_Values_Default_StaleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Default stale time`)
};

/**
* | output |
* | --- |
* | "Default stale time" |
*
* @param {Test_Harness_Values_Default_StaleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_values_default_stale = /** @type {((inputs?: Test_Harness_Values_Default_StaleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_Values_Default_StaleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_values_default_stale(inputs)
	return ko_test_harness_values_default_stale(inputs)
});