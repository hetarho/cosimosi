/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_Capability_Query_ClientInputs */

const en_test_harness_capability_query_client = /** @type {(inputs: Test_Harness_Capability_Query_ClientInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`QueryClient`)
};

const ko_test_harness_capability_query_client = /** @type {(inputs: Test_Harness_Capability_Query_ClientInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`QueryClient`)
};

/**
* | output |
* | --- |
* | "QueryClient" |
*
* @param {Test_Harness_Capability_Query_ClientInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_capability_query_client = /** @type {((inputs?: Test_Harness_Capability_Query_ClientInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_Capability_Query_ClientInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_capability_query_client(inputs)
	return ko_test_harness_capability_query_client(inputs)
});