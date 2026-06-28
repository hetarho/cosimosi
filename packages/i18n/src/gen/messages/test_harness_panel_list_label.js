/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_Panel_List_LabelInputs */

const en_test_harness_panel_list_label = /** @type {(inputs: Test_Harness_Panel_List_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Verification panels`)
};

const ko_test_harness_panel_list_label = /** @type {(inputs: Test_Harness_Panel_List_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`검증 패널`)
};

/**
* | output |
* | --- |
* | "Verification panels" |
*
* @param {Test_Harness_Panel_List_LabelInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_panel_list_label = /** @type {((inputs?: Test_Harness_Panel_List_LabelInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_Panel_List_LabelInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_panel_list_label(inputs)
	return ko_test_harness_panel_list_label(inputs)
});