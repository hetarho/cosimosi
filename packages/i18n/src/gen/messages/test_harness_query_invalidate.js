/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_Query_InvalidateInputs */

const en_test_harness_query_invalidate = /** @type {(inputs: Test_Harness_Query_InvalidateInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Invalidate`)
};

const ko_test_harness_query_invalidate = /** @type {(inputs: Test_Harness_Query_InvalidateInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Invalidate`)
};

/**
* | output |
* | --- |
* | "Invalidate" |
*
* @param {Test_Harness_Query_InvalidateInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_query_invalidate = /** @type {((inputs?: Test_Harness_Query_InvalidateInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_Query_InvalidateInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_query_invalidate(inputs)
	return ko_test_harness_query_invalidate(inputs)
});