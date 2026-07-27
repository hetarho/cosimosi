/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_Star_Shape_Prism_DescriptionInputs */

const en_test_harness_star_shape_prism_description = /** @type {(inputs: Test_Harness_Star_Shape_Prism_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Twelve jewel faces carry a wandering veil of color.`)
};

const ko_test_harness_star_shape_prism_description = /** @type {(inputs: Test_Harness_Star_Shape_Prism_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`열두 개 보석 면 위로 무지갯빛 장막이 천천히 흐릅니다.`)
};

/**
* | output |
* | --- |
* | "Twelve jewel faces carry a wandering veil of color." |
*
* @param {Test_Harness_Star_Shape_Prism_DescriptionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_star_shape_prism_description = /** @type {((inputs?: Test_Harness_Star_Shape_Prism_DescriptionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_Star_Shape_Prism_DescriptionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_star_shape_prism_description(inputs)
	return ko_test_harness_star_shape_prism_description(inputs)
});