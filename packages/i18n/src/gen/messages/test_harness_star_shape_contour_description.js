/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_Star_Shape_Contour_DescriptionInputs */

const en_test_harness_star_shape_contour_description = /** @type {(inputs: Test_Harness_Star_Shape_Contour_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`A softly moving world traced with the contours of remembrance.`)
};

const ko_test_harness_star_shape_contour_description = /** @type {(inputs: Test_Harness_Star_Shape_Contour_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`기억의 등고선을 두른 작은 지형이 부드럽게 꿈틀거립니다.`)
};

/**
* | output |
* | --- |
* | "A softly moving world traced with the contours of remembrance." |
*
* @param {Test_Harness_Star_Shape_Contour_DescriptionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_star_shape_contour_description = /** @type {((inputs?: Test_Harness_Star_Shape_Contour_DescriptionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_Star_Shape_Contour_DescriptionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_star_shape_contour_description(inputs)
	return ko_test_harness_star_shape_contour_description(inputs)
});