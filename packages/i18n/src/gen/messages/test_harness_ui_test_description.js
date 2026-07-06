/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_Ui_Test_DescriptionInputs */

const en_test_harness_ui_test_description = /** @type {(inputs: Test_Harness_Ui_Test_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`The whole design language on one surface: switch a universe preset (Aurora / Ember) to re-skin the 3D universe and every 2D component at once — universe+UI, the full component catalog, and a composed screen.`)
};

const ko_test_harness_ui_test_description = /** @type {(inputs: Test_Harness_Ui_Test_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`디자인 언어 전체를 한 화면에서: 우주 프리셋(Aurora / Ember)을 바꾸면 3D 우주와 모든 2D 컴포넌트가 한 번에 리스킨됩니다 — 우주+UI, 전체 컴포넌트 카탈로그, 조합 화면.`)
};

/**
* | output |
* | --- |
* | "The whole design language on one surface: switch a universe preset (Aurora / Ember) to re-skin the 3D universe and every 2D component at once — universe+UI, ..." |
*
* @param {Test_Harness_Ui_Test_DescriptionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_ui_test_description = /** @type {((inputs?: Test_Harness_Ui_Test_DescriptionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_Ui_Test_DescriptionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_ui_test_description(inputs)
	return ko_test_harness_ui_test_description(inputs)
});