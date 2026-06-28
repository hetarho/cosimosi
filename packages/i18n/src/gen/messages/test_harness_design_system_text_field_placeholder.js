/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_Design_System_Text_Field_PlaceholderInputs */

const en_test_harness_design_system_text_field_placeholder = /** @type {(inputs: Test_Harness_Design_System_Text_Field_PlaceholderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Type here`)
};

const ko_test_harness_design_system_text_field_placeholder = /** @type {(inputs: Test_Harness_Design_System_Text_Field_PlaceholderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`여기에 입력`)
};

/**
* | output |
* | --- |
* | "Type here" |
*
* @param {Test_Harness_Design_System_Text_Field_PlaceholderInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_design_system_text_field_placeholder = /** @type {((inputs?: Test_Harness_Design_System_Text_Field_PlaceholderInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_Design_System_Text_Field_PlaceholderInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_design_system_text_field_placeholder(inputs)
	return ko_test_harness_design_system_text_field_placeholder(inputs)
});