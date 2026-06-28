/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_Values_DescriptionInputs */

const en_test_harness_values_description = /** @type {(inputs: Test_Harness_Values_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Shows build-time constants emitted from spec/values.yaml.`)
};

const ko_test_harness_values_description = /** @type {(inputs: Test_Harness_Values_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`spec/values.yaml에서 생성된 build-time constant를 보여줍니다.`)
};

/**
* | output |
* | --- |
* | "Shows build-time constants emitted from spec/values.yaml." |
*
* @param {Test_Harness_Values_DescriptionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_values_description = /** @type {((inputs?: Test_Harness_Values_DescriptionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_Values_DescriptionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_values_description(inputs)
	return ko_test_harness_values_description(inputs)
});