/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_Capability_ValuesInputs */

const en_test_harness_capability_values = /** @type {(inputs: Test_Harness_Capability_ValuesInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Generated values`)
};

const ko_test_harness_capability_values = /** @type {(inputs: Test_Harness_Capability_ValuesInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Generated values`)
};

/**
* | output |
* | --- |
* | "Generated values" |
*
* @param {Test_Harness_Capability_ValuesInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_capability_values = /** @type {((inputs?: Test_Harness_Capability_ValuesInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_Capability_ValuesInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_capability_values(inputs)
	return ko_test_harness_capability_values(inputs)
});