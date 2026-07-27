/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_Star_Shape_Bubble_NameInputs */

const en_test_harness_star_shape_bubble_name = /** @type {(inputs: Test_Harness_Star_Shape_Bubble_NameInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Drifting Dew`)
};

const ko_test_harness_star_shape_bubble_name = /** @type {(inputs: Test_Harness_Star_Shape_Bubble_NameInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`떠도는 이슬`)
};

/**
* | output |
* | --- |
* | "Drifting Dew" |
*
* @param {Test_Harness_Star_Shape_Bubble_NameInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_star_shape_bubble_name = /** @type {((inputs?: Test_Harness_Star_Shape_Bubble_NameInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_Star_Shape_Bubble_NameInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_star_shape_bubble_name(inputs)
	return ko_test_harness_star_shape_bubble_name(inputs)
});