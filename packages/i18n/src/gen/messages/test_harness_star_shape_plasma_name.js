/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_Star_Shape_Plasma_NameInputs */

const en_test_harness_star_shape_plasma_name = /** @type {(inputs: Test_Harness_Star_Shape_Plasma_NameInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Ember Tide`)
};

const ko_test_harness_star_shape_plasma_name = /** @type {(inputs: Test_Harness_Star_Shape_Plasma_NameInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`불씨의 물결`)
};

/**
* | output |
* | --- |
* | "Ember Tide" |
*
* @param {Test_Harness_Star_Shape_Plasma_NameInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_star_shape_plasma_name = /** @type {((inputs?: Test_Harness_Star_Shape_Plasma_NameInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_Star_Shape_Plasma_NameInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_star_shape_plasma_name(inputs)
	return ko_test_harness_star_shape_plasma_name(inputs)
});