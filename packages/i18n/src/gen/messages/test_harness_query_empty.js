/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_Query_EmptyInputs */

const en_test_harness_query_empty = /** @type {(inputs: Test_Harness_Query_EmptyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`The query cache is empty.`)
};

const ko_test_harness_query_empty = /** @type {(inputs: Test_Harness_Query_EmptyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Query cache가 비어 있습니다.`)
};

/**
* | output |
* | --- |
* | "The query cache is empty." |
*
* @param {Test_Harness_Query_EmptyInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_query_empty = /** @type {((inputs?: Test_Harness_Query_EmptyInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_Query_EmptyInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_query_empty(inputs)
	return ko_test_harness_query_empty(inputs)
});