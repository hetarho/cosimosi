/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_Values_Retry_CountInputs */

const en_test_harness_values_retry_count = /** @type {(inputs: Test_Harness_Values_Retry_CountInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Retry count`)
};

const ko_test_harness_values_retry_count = /** @type {(inputs: Test_Harness_Values_Retry_CountInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Retry count`)
};

/**
* | output |
* | --- |
* | "Retry count" |
*
* @param {Test_Harness_Values_Retry_CountInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_values_retry_count = /** @type {((inputs?: Test_Harness_Values_Retry_CountInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_Values_Retry_CountInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_values_retry_count(inputs)
	return ko_test_harness_values_retry_count(inputs)
});