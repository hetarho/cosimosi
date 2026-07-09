/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_Background_Showcase_TitleInputs */

const en_test_harness_background_showcase_title = /** @type {(inputs: Test_Harness_Background_Showcase_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Emotion backdrops`)
};

const ko_test_harness_background_showcase_title = /** @type {(inputs: Test_Harness_Background_Showcase_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`감정 배경`)
};

/**
* | output |
* | --- |
* | "Emotion backdrops" |
*
* @param {Test_Harness_Background_Showcase_TitleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_background_showcase_title = /** @type {((inputs?: Test_Harness_Background_Showcase_TitleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_Background_Showcase_TitleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_background_showcase_title(inputs)
	return ko_test_harness_background_showcase_title(inputs)
});