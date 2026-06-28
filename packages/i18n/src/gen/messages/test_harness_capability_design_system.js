/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_Capability_Design_SystemInputs */

const en_test_harness_capability_design_system = /** @type {(inputs: Test_Harness_Capability_Design_SystemInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Design system`)
};

const ko_test_harness_capability_design_system = /** @type {(inputs: Test_Harness_Capability_Design_SystemInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Design system`)
};

/**
* | output |
* | --- |
* | "Design system" |
*
* @param {Test_Harness_Capability_Design_SystemInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_capability_design_system = /** @type {((inputs?: Test_Harness_Capability_Design_SystemInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_Capability_Design_SystemInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_capability_design_system(inputs)
	return ko_test_harness_capability_design_system(inputs)
});