/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_Star_Shape_EmotionsInputs */

const en_test_harness_star_shape_emotions = /** @type {(inputs: Test_Harness_Star_Shape_EmotionsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`One star per emotion`)
};

const ko_test_harness_star_shape_emotions = /** @type {(inputs: Test_Harness_Star_Shape_EmotionsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`감정마다 별 하나`)
};

/**
* | output |
* | --- |
* | "One star per emotion" |
*
* @param {Test_Harness_Star_Shape_EmotionsInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_star_shape_emotions = /** @type {((inputs?: Test_Harness_Star_Shape_EmotionsInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_Star_Shape_EmotionsInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_star_shape_emotions(inputs)
	return ko_test_harness_star_shape_emotions(inputs)
});