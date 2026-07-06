/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_Ui_Gallery_DescriptionInputs */

const en_test_harness_ui_gallery_description = /** @type {(inputs: Test_Harness_Ui_Gallery_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`The full button + primitive catalog across variants, sizes, and states — the surface we tune the 2D design language on.`)
};

const ko_test_harness_ui_gallery_description = /** @type {(inputs: Test_Harness_Ui_Gallery_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`버튼과 primitive 전체 카탈로그 — variant·크기·상태별. 2D 디자인 언어를 맞춰가는 화면입니다.`)
};

/**
* | output |
* | --- |
* | "The full button + primitive catalog across variants, sizes, and states — the surface we tune the 2D design language on." |
*
* @param {Test_Harness_Ui_Gallery_DescriptionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_ui_gallery_description = /** @type {((inputs?: Test_Harness_Ui_Gallery_DescriptionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_Ui_Gallery_DescriptionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_ui_gallery_description(inputs)
	return ko_test_harness_ui_gallery_description(inputs)
});