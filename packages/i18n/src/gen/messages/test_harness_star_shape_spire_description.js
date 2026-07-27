/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_Star_Shape_Spire_DescriptionInputs */

const en_test_harness_star_shape_spire_description = /** @type {(inputs: Test_Harness_Star_Shape_Spire_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Eight crystalline rays turn slowly toward their own north.`)
};

const ko_test_harness_star_shape_spire_description = /** @type {(inputs: Test_Harness_Star_Shape_Spire_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`여덟 개 수정빛 갈래가 저마다의 북쪽을 향해 천천히 돕니다.`)
};

/**
* | output |
* | --- |
* | "Eight crystalline rays turn slowly toward their own north." |
*
* @param {Test_Harness_Star_Shape_Spire_DescriptionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_star_shape_spire_description = /** @type {((inputs?: Test_Harness_Star_Shape_Spire_DescriptionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_Star_Shape_Spire_DescriptionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_star_shape_spire_description(inputs)
	return ko_test_harness_star_shape_spire_description(inputs)
});