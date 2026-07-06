/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_Theme_DescriptionInputs */

const en_test_harness_theme_description = /** @type {(inputs: Test_Harness_Theme_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Switch a universe preset (Aurora / Ember) — one control drives the 3D skin and the 2D theme together, shown over a universe+UI view and a UI-only view.`)
};

const ko_test_harness_theme_description = /** @type {(inputs: Test_Harness_Theme_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`우주 프리셋(Aurora / Ember) 전환 — 하나의 컨트롤이 3D 스킨과 2D 테마를 동시에 바꿉니다. 우주+UI, UI-only 둘 다 확인.`)
};

/**
* | output |
* | --- |
* | "Switch a universe preset (Aurora / Ember) — one control drives the 3D skin and the 2D theme together, shown over a universe+UI view and a UI-only view." |
*
* @param {Test_Harness_Theme_DescriptionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_theme_description = /** @type {((inputs?: Test_Harness_Theme_DescriptionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_Theme_DescriptionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_theme_description(inputs)
	return ko_test_harness_theme_description(inputs)
});