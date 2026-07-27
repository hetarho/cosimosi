/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_Star_Shape_Haze_DescriptionInputs */

const en_test_harness_star_shape_haze_description = /** @type {(inputs: Test_Harness_Star_Shape_Haze_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`A wavering breath of light, almost without an edge.`)
};

const ko_test_harness_star_shape_haze_description = /** @type {(inputs: Test_Harness_Star_Shape_Haze_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`경계마저 흐릿한 빛 한숨이 잔잔하게 흔들립니다.`)
};

/**
* | output |
* | --- |
* | "A wavering breath of light, almost without an edge." |
*
* @param {Test_Harness_Star_Shape_Haze_DescriptionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_star_shape_haze_description = /** @type {((inputs?: Test_Harness_Star_Shape_Haze_DescriptionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_Star_Shape_Haze_DescriptionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_star_shape_haze_description(inputs)
	return ko_test_harness_star_shape_haze_description(inputs)
});