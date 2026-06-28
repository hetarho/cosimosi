/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_Panel_Unavailable_DescriptionInputs */

const en_test_harness_panel_unavailable_description = /** @type {(inputs: Test_Harness_Panel_Unavailable_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`This panel is registered, but one or more dependencies are not available in the current harness.`)
};

const ko_test_harness_panel_unavailable_description = /** @type {(inputs: Test_Harness_Panel_Unavailable_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`패널은 등록되어 있지만 현재 하네스에서 필요한 의존성이 아직 준비되지 않았습니다.`)
};

/**
* | output |
* | --- |
* | "This panel is registered, but one or more dependencies are not available in the current harness." |
*
* @param {Test_Harness_Panel_Unavailable_DescriptionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_panel_unavailable_description = /** @type {((inputs?: Test_Harness_Panel_Unavailable_DescriptionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_Panel_Unavailable_DescriptionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_panel_unavailable_description(inputs)
	return ko_test_harness_panel_unavailable_description(inputs)
});