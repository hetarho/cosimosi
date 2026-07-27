/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_Star_Shape_Bubble_DescriptionInputs */

const en_test_harness_star_shape_bubble_description = /** @type {(inputs: Test_Harness_Star_Shape_Bubble_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`A tender, breathing skin of light with an airy heart.`)
};

const ko_test_harness_star_shape_bubble_description = /** @type {(inputs: Test_Harness_Star_Shape_Bubble_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`속은 가볍고 표면은 숨 쉬듯 몽글거리는 빛의 이슬입니다.`)
};

/**
* | output |
* | --- |
* | "A tender, breathing skin of light with an airy heart." |
*
* @param {Test_Harness_Star_Shape_Bubble_DescriptionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_star_shape_bubble_description = /** @type {((inputs?: Test_Harness_Star_Shape_Bubble_DescriptionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_Star_Shape_Bubble_DescriptionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_star_shape_bubble_description(inputs)
	return ko_test_harness_star_shape_bubble_description(inputs)
});