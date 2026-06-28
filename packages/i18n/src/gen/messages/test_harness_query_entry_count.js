/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_Query_Entry_CountInputs */

const en_test_harness_query_entry_count = /** @type {(inputs: Test_Harness_Query_Entry_CountInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Cache entries`)
};

const ko_test_harness_query_entry_count = /** @type {(inputs: Test_Harness_Query_Entry_CountInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Cache entries`)
};

/**
* | output |
* | --- |
* | "Cache entries" |
*
* @param {Test_Harness_Query_Entry_CountInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_query_entry_count = /** @type {((inputs?: Test_Harness_Query_Entry_CountInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_Query_Entry_CountInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_query_entry_count(inputs)
	return ko_test_harness_query_entry_count(inputs)
});