/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_Star_Shape_Orb_DescriptionInputs */

const en_test_harness_star_shape_orb_description = /** @type {(inputs: Test_Harness_Star_Shape_Orb_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`A seed-born light with a softly weathered surface.`)
};

const ko_test_harness_star_shape_orb_description = /** @type {(inputs: Test_Harness_Star_Shape_Orb_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`씨앗에서 태어난 빛이 바람에 닳은 듯한 표면을 품습니다.`)
};

/**
* | output |
* | --- |
* | "A seed-born light with a softly weathered surface." |
*
* @param {Test_Harness_Star_Shape_Orb_DescriptionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_star_shape_orb_description = /** @type {((inputs?: Test_Harness_Star_Shape_Orb_DescriptionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_Star_Shape_Orb_DescriptionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_star_shape_orb_description(inputs)
	return ko_test_harness_star_shape_orb_description(inputs)
});