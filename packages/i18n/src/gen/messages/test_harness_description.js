/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_DescriptionInputs */

const en_test_harness_description = /** @type {(inputs: Test_Harness_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Temporary verification panels for Phase 1 seams and later headless units.`)
};

const ko_test_harness_description = /** @type {(inputs: Test_Harness_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Phase 1 seam과 이후 headless unit을 확인하는 임시 검증 패널입니다.`)
};

/**
* | output |
* | --- |
* | "Temporary verification panels for Phase 1 seams and later headless units." |
*
* @param {Test_Harness_DescriptionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_description = /** @type {((inputs?: Test_Harness_DescriptionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_DescriptionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_description(inputs)
	return ko_test_harness_description(inputs)
});