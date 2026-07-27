/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_Star_Shape_Geode_DescriptionInputs */

const en_test_harness_star_shape_geode_description = /** @type {(inputs: Test_Harness_Star_Shape_Geode_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`A rough crystal shell with dawn glowing through its seams.`)
};

const ko_test_harness_star_shape_geode_description = /** @type {(inputs: Test_Harness_Star_Shape_Geode_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`거친 수정 껍질의 틈마다 새벽빛이 스며 나옵니다.`)
};

/**
* | output |
* | --- |
* | "A rough crystal shell with dawn glowing through its seams." |
*
* @param {Test_Harness_Star_Shape_Geode_DescriptionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_star_shape_geode_description = /** @type {((inputs?: Test_Harness_Star_Shape_Geode_DescriptionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_Star_Shape_Geode_DescriptionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_star_shape_geode_description(inputs)
	return ko_test_harness_star_shape_geode_description(inputs)
});