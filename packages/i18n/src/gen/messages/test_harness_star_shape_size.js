/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_Star_Shape_SizeInputs */

const en_test_harness_star_shape_size = /** @type {(inputs: Test_Harness_Star_Shape_SizeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Size`)
};

const ko_test_harness_star_shape_size = /** @type {(inputs: Test_Harness_Star_Shape_SizeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`크기`)
};

/**
* | output |
* | --- |
* | "Size" |
*
* @param {Test_Harness_Star_Shape_SizeInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_star_shape_size = /** @type {((inputs?: Test_Harness_Star_Shape_SizeInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_Star_Shape_SizeInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_star_shape_size(inputs)
	return ko_test_harness_star_shape_size(inputs)
});