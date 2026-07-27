/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_Star_Shape_Orb_NameInputs */

const en_test_harness_star_shape_orb_name = /** @type {(inputs: Test_Harness_Star_Shape_Orb_NameInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`First Light`)
};

const ko_test_harness_star_shape_orb_name = /** @type {(inputs: Test_Harness_Star_Shape_Orb_NameInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`첫빛`)
};

/**
* | output |
* | --- |
* | "First Light" |
*
* @param {Test_Harness_Star_Shape_Orb_NameInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_star_shape_orb_name = /** @type {((inputs?: Test_Harness_Star_Shape_Orb_NameInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_Star_Shape_Orb_NameInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_star_shape_orb_name(inputs)
	return ko_test_harness_star_shape_orb_name(inputs)
});