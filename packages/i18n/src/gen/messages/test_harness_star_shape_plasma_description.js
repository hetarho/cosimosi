/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_Star_Shape_Plasma_DescriptionInputs */

const en_test_harness_star_shape_plasma_description = /** @type {(inputs: Test_Harness_Star_Shape_Plasma_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Warm currents fold and unfurl across a living surface.`)
};

const ko_test_harness_star_shape_plasma_description = /** @type {(inputs: Test_Harness_Star_Shape_Plasma_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`살아 있는 표면 위로 따뜻한 불씨의 물결이 접히고 풀립니다.`)
};

/**
* | output |
* | --- |
* | "Warm currents fold and unfurl across a living surface." |
*
* @param {Test_Harness_Star_Shape_Plasma_DescriptionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_star_shape_plasma_description = /** @type {((inputs?: Test_Harness_Star_Shape_Plasma_DescriptionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_Star_Shape_Plasma_DescriptionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_star_shape_plasma_description(inputs)
	return ko_test_harness_star_shape_plasma_description(inputs)
});