/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_Capability_Golden_ParityInputs */

const en_test_harness_capability_golden_parity = /** @type {(inputs: Test_Harness_Capability_Golden_ParityInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Golden parity`)
};

const ko_test_harness_capability_golden_parity = /** @type {(inputs: Test_Harness_Capability_Golden_ParityInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Golden parity`)
};

/**
* | output |
* | --- |
* | "Golden parity" |
*
* @param {Test_Harness_Capability_Golden_ParityInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_capability_golden_parity = /** @type {((inputs?: Test_Harness_Capability_Golden_ParityInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_Capability_Golden_ParityInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_capability_golden_parity(inputs)
	return ko_test_harness_capability_golden_parity(inputs)
});