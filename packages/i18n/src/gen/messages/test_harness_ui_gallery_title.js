/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_Ui_Gallery_TitleInputs */

const en_test_harness_ui_gallery_title = /** @type {(inputs: Test_Harness_Ui_Gallery_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`UI gallery`)
};

const ko_test_harness_ui_gallery_title = /** @type {(inputs: Test_Harness_Ui_Gallery_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`UI 갤러리`)
};

/**
* | output |
* | --- |
* | "UI gallery" |
*
* @param {Test_Harness_Ui_Gallery_TitleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_ui_gallery_title = /** @type {((inputs?: Test_Harness_Ui_Gallery_TitleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_Ui_Gallery_TitleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_ui_gallery_title(inputs)
	return ko_test_harness_ui_gallery_title(inputs)
});