/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_Query_HashInputs */

const en_test_harness_query_hash = /** @type {(inputs: Test_Harness_Query_HashInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Query hash`)
};

const ko_test_harness_query_hash = /** @type {(inputs: Test_Harness_Query_HashInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Query hash`)
};

/**
* | output |
* | --- |
* | "Query hash" |
*
* @param {Test_Harness_Query_HashInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_query_hash = /** @type {((inputs?: Test_Harness_Query_HashInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_Query_HashInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_query_hash(inputs)
	return ko_test_harness_query_hash(inputs)
});