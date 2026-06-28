/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_Query_ClearInputs */

const en_test_harness_query_clear = /** @type {(inputs: Test_Harness_Query_ClearInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Clear`)
};

const ko_test_harness_query_clear = /** @type {(inputs: Test_Harness_Query_ClearInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Clear`)
};

/**
* | output |
* | --- |
* | "Clear" |
*
* @param {Test_Harness_Query_ClearInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_query_clear = /** @type {((inputs?: Test_Harness_Query_ClearInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_Query_ClearInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_query_clear(inputs)
	return ko_test_harness_query_clear(inputs)
});