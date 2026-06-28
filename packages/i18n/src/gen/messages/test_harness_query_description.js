/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_Query_DescriptionInputs */

const en_test_harness_query_description = /** @type {(inputs: Test_Harness_Query_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Inspects TanStack Query state and seeds deterministic fake cache data.`)
};

const ko_test_harness_query_description = /** @type {(inputs: Test_Harness_Query_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`TanStack Query 상태를 확인하고 결정적인 fake cache data를 주입합니다.`)
};

/**
* | output |
* | --- |
* | "Inspects TanStack Query state and seeds deterministic fake cache data." |
*
* @param {Test_Harness_Query_DescriptionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_query_description = /** @type {((inputs?: Test_Harness_Query_DescriptionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_Query_DescriptionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_query_description(inputs)
	return ko_test_harness_query_description(inputs)
});