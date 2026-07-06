/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_Theme_TitleInputs */

const en_test_harness_theme_title = /** @type {(inputs: Test_Harness_Theme_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Theme presets`)
};

const ko_test_harness_theme_title = /** @type {(inputs: Test_Harness_Theme_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`테마 프리셋`)
};

/**
* | output |
* | --- |
* | "Theme presets" |
*
* @param {Test_Harness_Theme_TitleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_theme_title = /** @type {((inputs?: Test_Harness_Theme_TitleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_Theme_TitleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_theme_title(inputs)
	return ko_test_harness_theme_title(inputs)
});