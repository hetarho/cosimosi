/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_Star_Shape_ControlInputs */

const en_test_harness_star_shape_control = /** @type {(inputs: Test_Harness_Star_Shape_ControlInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Star form`)
};

const ko_test_harness_star_shape_control = /** @type {(inputs: Test_Harness_Star_Shape_ControlInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`별의 모습`)
};

/**
* | output |
* | --- |
* | "Star form" |
*
* @param {Test_Harness_Star_Shape_ControlInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_star_shape_control = /** @type {((inputs?: Test_Harness_Star_Shape_ControlInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_Star_Shape_ControlInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_star_shape_control(inputs)
	return ko_test_harness_star_shape_control(inputs)
});