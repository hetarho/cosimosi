/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_Flat_TitleInputs */

const en_test_harness_flat_title = /** @type {(inputs: Test_Harness_Flat_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Flat 2D screen`)
};

const ko_test_harness_flat_title = /** @type {(inputs: Test_Harness_Flat_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`2D 전용 화면`)
};

/**
* | output |
* | --- |
* | "Flat 2D screen" |
*
* @param {Test_Harness_Flat_TitleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_flat_title = /** @type {((inputs?: Test_Harness_Flat_TitleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_Flat_TitleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_flat_title(inputs)
	return ko_test_harness_flat_title(inputs)
});