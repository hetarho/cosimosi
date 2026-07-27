/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_Star_Shape_Prism_NameInputs */

const en_test_harness_star_shape_prism_name = /** @type {(inputs: Test_Harness_Star_Shape_Prism_NameInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Prismatic Dream`)
};

const ko_test_harness_star_shape_prism_name = /** @type {(inputs: Test_Harness_Star_Shape_Prism_NameInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`무지갯빛 꿈`)
};

/**
* | output |
* | --- |
* | "Prismatic Dream" |
*
* @param {Test_Harness_Star_Shape_Prism_NameInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_star_shape_prism_name = /** @type {((inputs?: Test_Harness_Star_Shape_Prism_NameInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_Star_Shape_Prism_NameInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_star_shape_prism_name(inputs)
	return ko_test_harness_star_shape_prism_name(inputs)
});