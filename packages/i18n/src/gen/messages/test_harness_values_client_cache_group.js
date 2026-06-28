/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_Values_Client_Cache_GroupInputs */

const en_test_harness_values_client_cache_group = /** @type {(inputs: Test_Harness_Values_Client_Cache_GroupInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`client_cache`)
};

const ko_test_harness_values_client_cache_group = /** @type {(inputs: Test_Harness_Values_Client_Cache_GroupInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`client_cache`)
};

/**
* | output |
* | --- |
* | "client_cache" |
*
* @param {Test_Harness_Values_Client_Cache_GroupInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_values_client_cache_group = /** @type {((inputs?: Test_Harness_Values_Client_Cache_GroupInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_Values_Client_Cache_GroupInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_values_client_cache_group(inputs)
	return ko_test_harness_values_client_cache_group(inputs)
});