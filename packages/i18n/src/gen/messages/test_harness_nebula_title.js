/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_Nebula_TitleInputs */

const en_test_harness_nebula_title = /** @type {(inputs: Test_Harness_Nebula_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Emotion nebula`)
};

const ko_test_harness_nebula_title = /** @type {(inputs: Test_Harness_Nebula_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`감정 성운`)
};

/**
* | output |
* | --- |
* | "Emotion nebula" |
*
* @param {Test_Harness_Nebula_TitleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_nebula_title = /** @type {((inputs?: Test_Harness_Nebula_TitleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_Nebula_TitleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_nebula_title(inputs)
	return ko_test_harness_nebula_title(inputs)
});