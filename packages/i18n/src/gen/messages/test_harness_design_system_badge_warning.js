/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_Design_System_Badge_WarningInputs */

const en_test_harness_design_system_badge_warning = /** @type {(inputs: Test_Harness_Design_System_Badge_WarningInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Warning`)
};

const ko_test_harness_design_system_badge_warning = /** @type {(inputs: Test_Harness_Design_System_Badge_WarningInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Warning`)
};

/**
* | output |
* | --- |
* | "Warning" |
*
* @param {Test_Harness_Design_System_Badge_WarningInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_design_system_badge_warning = /** @type {((inputs?: Test_Harness_Design_System_Badge_WarningInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_Design_System_Badge_WarningInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_design_system_badge_warning(inputs)
	return ko_test_harness_design_system_badge_warning(inputs)
});