/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_No_UserInputs */

const en_test_harness_no_user = /** @type {(inputs: Test_Harness_No_UserInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`No user`)
};

const ko_test_harness_no_user = /** @type {(inputs: Test_Harness_No_UserInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`사용자 없음`)
};

/**
* | output |
* | --- |
* | "No user" |
*
* @param {Test_Harness_No_UserInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_no_user = /** @type {((inputs?: Test_Harness_No_UserInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_No_UserInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_no_user(inputs)
	return ko_test_harness_no_user(inputs)
});