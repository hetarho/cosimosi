/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_Design_System_Button_PrimaryInputs */

const en_test_harness_design_system_button_primary = /** @type {(inputs: Test_Harness_Design_System_Button_PrimaryInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Primary`)
};

const ko_test_harness_design_system_button_primary = /** @type {(inputs: Test_Harness_Design_System_Button_PrimaryInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Primary`)
};

/**
* | output |
* | --- |
* | "Primary" |
*
* @param {Test_Harness_Design_System_Button_PrimaryInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_design_system_button_primary = /** @type {((inputs?: Test_Harness_Design_System_Button_PrimaryInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_Design_System_Button_PrimaryInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_design_system_button_primary(inputs)
	return ko_test_harness_design_system_button_primary(inputs)
});