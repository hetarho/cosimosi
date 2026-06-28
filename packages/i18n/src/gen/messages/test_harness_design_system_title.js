/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_Design_System_TitleInputs */

const en_test_harness_design_system_title = /** @type {(inputs: Test_Harness_Design_System_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Design system`)
};

const ko_test_harness_design_system_title = /** @type {(inputs: Test_Harness_Design_System_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Design system`)
};

/**
* | output |
* | --- |
* | "Design system" |
*
* @param {Test_Harness_Design_System_TitleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_design_system_title = /** @type {((inputs?: Test_Harness_Design_System_TitleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_Design_System_TitleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_design_system_title(inputs)
	return ko_test_harness_design_system_title(inputs)
});