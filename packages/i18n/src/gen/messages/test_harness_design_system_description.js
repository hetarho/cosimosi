/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_Design_System_DescriptionInputs */

const en_test_harness_design_system_description = /** @type {(inputs: Test_Harness_Design_System_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Renders shared primitive states through @cosimosi/ui.`)
};

const ko_test_harness_design_system_description = /** @type {(inputs: Test_Harness_Design_System_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`@cosimosi/ui의 shared primitive 상태를 렌더링합니다.`)
};

/**
* | output |
* | --- |
* | "Renders shared primitive states through @cosimosi/ui." |
*
* @param {Test_Harness_Design_System_DescriptionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_design_system_description = /** @type {((inputs?: Test_Harness_Design_System_DescriptionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_Design_System_DescriptionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_design_system_description(inputs)
	return ko_test_harness_design_system_description(inputs)
});