/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_Star_Shape_Urchin_DescriptionInputs */

const en_test_harness_star_shape_urchin_description = /** @type {(inputs: Test_Harness_Star_Shape_Urchin_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`A hushed core wrapped in bright, protective thorns.`)
};

const ko_test_harness_star_shape_urchin_description = /** @type {(inputs: Test_Harness_Star_Shape_Urchin_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`고요한 중심을 밝고 단단한 가시가 포근히 감쌉니다.`)
};

/**
* | output |
* | --- |
* | "A hushed core wrapped in bright, protective thorns." |
*
* @param {Test_Harness_Star_Shape_Urchin_DescriptionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_star_shape_urchin_description = /** @type {((inputs?: Test_Harness_Star_Shape_Urchin_DescriptionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_Star_Shape_Urchin_DescriptionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_star_shape_urchin_description(inputs)
	return ko_test_harness_star_shape_urchin_description(inputs)
});