/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_Star_Shape_Urchin_NameInputs */

const en_test_harness_star_shape_urchin_name = /** @type {(inputs: Test_Harness_Star_Shape_Urchin_NameInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Thornlight`)
};

const ko_test_harness_star_shape_urchin_name = /** @type {(inputs: Test_Harness_Star_Shape_Urchin_NameInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`가시빛`)
};

/**
* | output |
* | --- |
* | "Thornlight" |
*
* @param {Test_Harness_Star_Shape_Urchin_NameInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_star_shape_urchin_name = /** @type {((inputs?: Test_Harness_Star_Shape_Urchin_NameInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_Star_Shape_Urchin_NameInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_star_shape_urchin_name(inputs)
	return ko_test_harness_star_shape_urchin_name(inputs)
});