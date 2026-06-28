/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_Query_Seed_FakeInputs */

const en_test_harness_query_seed_fake = /** @type {(inputs: Test_Harness_Query_Seed_FakeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Seed fake query`)
};

const ko_test_harness_query_seed_fake = /** @type {(inputs: Test_Harness_Query_Seed_FakeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Fake query 주입`)
};

/**
* | output |
* | --- |
* | "Seed fake query" |
*
* @param {Test_Harness_Query_Seed_FakeInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_query_seed_fake = /** @type {((inputs?: Test_Harness_Query_Seed_FakeInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_Query_Seed_FakeInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_query_seed_fake(inputs)
	return ko_test_harness_query_seed_fake(inputs)
});