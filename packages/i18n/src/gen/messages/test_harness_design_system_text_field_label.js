/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_Design_System_Text_Field_LabelInputs */

const en_test_harness_design_system_text_field_label = /** @type {(inputs: Test_Harness_Design_System_Text_Field_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Text field`)
};

const ko_test_harness_design_system_text_field_label = /** @type {(inputs: Test_Harness_Design_System_Text_Field_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Text field`)
};

/**
* | output |
* | --- |
* | "Text field" |
*
* @param {Test_Harness_Design_System_Text_Field_LabelInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_design_system_text_field_label = /** @type {((inputs?: Test_Harness_Design_System_Text_Field_LabelInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_Design_System_Text_Field_LabelInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_design_system_text_field_label(inputs)
	return ko_test_harness_design_system_text_field_label(inputs)
});