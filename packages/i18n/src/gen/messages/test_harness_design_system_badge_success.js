/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_Design_System_Badge_SuccessInputs */

const en_test_harness_design_system_badge_success = /** @type {(inputs: Test_Harness_Design_System_Badge_SuccessInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Success`)
};

const ko_test_harness_design_system_badge_success = /** @type {(inputs: Test_Harness_Design_System_Badge_SuccessInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Success`)
};

/**
* | output |
* | --- |
* | "Success" |
*
* @param {Test_Harness_Design_System_Badge_SuccessInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_design_system_badge_success = /** @type {((inputs?: Test_Harness_Design_System_Badge_SuccessInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_Design_System_Badge_SuccessInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_design_system_badge_success(inputs)
	return ko_test_harness_design_system_badge_success(inputs)
});