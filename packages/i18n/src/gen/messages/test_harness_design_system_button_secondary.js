/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_Design_System_Button_SecondaryInputs */

const en_test_harness_design_system_button_secondary = /** @type {(inputs: Test_Harness_Design_System_Button_SecondaryInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Secondary`)
};

const ko_test_harness_design_system_button_secondary = /** @type {(inputs: Test_Harness_Design_System_Button_SecondaryInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Secondary`)
};

/**
* | output |
* | --- |
* | "Secondary" |
*
* @param {Test_Harness_Design_System_Button_SecondaryInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_design_system_button_secondary = /** @type {((inputs?: Test_Harness_Design_System_Button_SecondaryInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_Design_System_Button_SecondaryInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_design_system_button_secondary(inputs)
	return ko_test_harness_design_system_button_secondary(inputs)
});