/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_Panel_Unavailable_TitleInputs */

const en_test_harness_panel_unavailable_title = /** @type {(inputs: Test_Harness_Panel_Unavailable_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Panel unavailable`)
};

const ko_test_harness_panel_unavailable_title = /** @type {(inputs: Test_Harness_Panel_Unavailable_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`패널을 사용할 수 없음`)
};

/**
* | output |
* | --- |
* | "Panel unavailable" |
*
* @param {Test_Harness_Panel_Unavailable_TitleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_panel_unavailable_title = /** @type {((inputs?: Test_Harness_Panel_Unavailable_TitleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_Panel_Unavailable_TitleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_panel_unavailable_title(inputs)
	return ko_test_harness_panel_unavailable_title(inputs)
});