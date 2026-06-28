/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_Status_SuccessInputs */

const en_test_harness_status_success = /** @type {(inputs: Test_Harness_Status_SuccessInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Success`)
};

const ko_test_harness_status_success = /** @type {(inputs: Test_Harness_Status_SuccessInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`성공`)
};

/**
* | output |
* | --- |
* | "Success" |
*
* @param {Test_Harness_Status_SuccessInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_status_success = /** @type {((inputs?: Test_Harness_Status_SuccessInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_Status_SuccessInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_status_success(inputs)
	return ko_test_harness_status_success(inputs)
});