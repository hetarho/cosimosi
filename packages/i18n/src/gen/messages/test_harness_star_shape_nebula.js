/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_Star_Shape_NebulaInputs */

const en_test_harness_star_shape_nebula = /** @type {(inputs: Test_Harness_Star_Shape_NebulaInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Emotion nebula`)
};

const ko_test_harness_star_shape_nebula = /** @type {(inputs: Test_Harness_Star_Shape_NebulaInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`감정 성운`)
};

/**
* | output |
* | --- |
* | "Emotion nebula" |
*
* @param {Test_Harness_Star_Shape_NebulaInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_star_shape_nebula = /** @type {((inputs?: Test_Harness_Star_Shape_NebulaInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_Star_Shape_NebulaInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_star_shape_nebula(inputs)
	return ko_test_harness_star_shape_nebula(inputs)
});