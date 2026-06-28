/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_Design_System_Switch_LabelInputs */

const en_test_harness_design_system_switch_label = /** @type {(inputs: Test_Harness_Design_System_Switch_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Switch`)
};

const ko_test_harness_design_system_switch_label = /** @type {(inputs: Test_Harness_Design_System_Switch_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Switch`)
};

/**
* | output |
* | --- |
* | "Switch" |
*
* @param {Test_Harness_Design_System_Switch_LabelInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_design_system_switch_label = /** @type {((inputs?: Test_Harness_Design_System_Switch_LabelInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_Design_System_Switch_LabelInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_design_system_switch_label(inputs)
	return ko_test_harness_design_system_switch_label(inputs)
});