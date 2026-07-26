/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_Star_Shape_TitleInputs */

const en_test_harness_star_shape_title = /** @type {(inputs: Test_Harness_Star_Shape_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Star shapes`)
};

const ko_test_harness_star_shape_title = /** @type {(inputs: Test_Harness_Star_Shape_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`별의 모양`)
};

/**
* | output |
* | --- |
* | "Star shapes" |
*
* @param {Test_Harness_Star_Shape_TitleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_star_shape_title = /** @type {((inputs?: Test_Harness_Star_Shape_TitleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_Star_Shape_TitleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_star_shape_title(inputs)
	return ko_test_harness_star_shape_title(inputs)
});