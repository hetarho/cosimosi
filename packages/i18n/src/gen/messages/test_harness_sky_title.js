/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_Sky_TitleInputs */

const en_test_harness_sky_title = /** @type {(inputs: Test_Harness_Sky_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Emotion sky (3D)`)
};

const ko_test_harness_sky_title = /** @type {(inputs: Test_Harness_Sky_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`감정 하늘 (3D)`)
};

/**
* | output |
* | --- |
* | "Emotion sky (3D)" |
*
* @param {Test_Harness_Sky_TitleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_sky_title = /** @type {((inputs?: Test_Harness_Sky_TitleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_Sky_TitleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_sky_title(inputs)
	return ko_test_harness_sky_title(inputs)
});