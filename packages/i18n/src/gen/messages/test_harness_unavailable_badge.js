/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_Unavailable_BadgeInputs */

const en_test_harness_unavailable_badge = /** @type {(inputs: Test_Harness_Unavailable_BadgeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Unavailable`)
};

const ko_test_harness_unavailable_badge = /** @type {(inputs: Test_Harness_Unavailable_BadgeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`사용 불가`)
};

/**
* | output |
* | --- |
* | "Unavailable" |
*
* @param {Test_Harness_Unavailable_BadgeInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_unavailable_badge = /** @type {((inputs?: Test_Harness_Unavailable_BadgeInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_Unavailable_BadgeInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_unavailable_badge(inputs)
	return ko_test_harness_unavailable_badge(inputs)
});