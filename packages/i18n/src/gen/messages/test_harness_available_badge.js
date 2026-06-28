/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_Available_BadgeInputs */

const en_test_harness_available_badge = /** @type {(inputs: Test_Harness_Available_BadgeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Available`)
};

const ko_test_harness_available_badge = /** @type {(inputs: Test_Harness_Available_BadgeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`사용 가능`)
};

/**
* | output |
* | --- |
* | "Available" |
*
* @param {Test_Harness_Available_BadgeInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_available_badge = /** @type {((inputs?: Test_Harness_Available_BadgeInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_Available_BadgeInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_available_badge(inputs)
	return ko_test_harness_available_badge(inputs)
});