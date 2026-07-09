/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_Background_Showcase_Reduced_MotionInputs */

const en_test_harness_background_showcase_reduced_motion = /** @type {(inputs: Test_Harness_Background_Showcase_Reduced_MotionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Reduced motion — frozen`)
};

const ko_test_harness_background_showcase_reduced_motion = /** @type {(inputs: Test_Harness_Background_Showcase_Reduced_MotionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`모션 최소화 — 정지`)
};

/**
* | output |
* | --- |
* | "Reduced motion — frozen" |
*
* @param {Test_Harness_Background_Showcase_Reduced_MotionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_background_showcase_reduced_motion = /** @type {((inputs?: Test_Harness_Background_Showcase_Reduced_MotionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_Background_Showcase_Reduced_MotionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_background_showcase_reduced_motion(inputs)
	return ko_test_harness_background_showcase_reduced_motion(inputs)
});