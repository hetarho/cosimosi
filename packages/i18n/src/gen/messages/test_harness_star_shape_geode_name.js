/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_Star_Shape_Geode_NameInputs */

const en_test_harness_star_shape_geode_name = /** @type {(inputs: Test_Harness_Star_Shape_Geode_NameInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Veins of Dawn`)
};

const ko_test_harness_star_shape_geode_name = /** @type {(inputs: Test_Harness_Star_Shape_Geode_NameInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`새벽의 결`)
};

/**
* | output |
* | --- |
* | "Veins of Dawn" |
*
* @param {Test_Harness_Star_Shape_Geode_NameInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_star_shape_geode_name = /** @type {((inputs?: Test_Harness_Star_Shape_Geode_NameInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_Star_Shape_Geode_NameInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_star_shape_geode_name(inputs)
	return ko_test_harness_star_shape_geode_name(inputs)
});