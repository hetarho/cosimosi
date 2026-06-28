/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_Values_Default_GcInputs */

const en_test_harness_values_default_gc = /** @type {(inputs: Test_Harness_Values_Default_GcInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Default GC time`)
};

const ko_test_harness_values_default_gc = /** @type {(inputs: Test_Harness_Values_Default_GcInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Default GC time`)
};

/**
* | output |
* | --- |
* | "Default GC time" |
*
* @param {Test_Harness_Values_Default_GcInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_values_default_gc = /** @type {((inputs?: Test_Harness_Values_Default_GcInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_Values_Default_GcInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_values_default_gc(inputs)
	return ko_test_harness_values_default_gc(inputs)
});