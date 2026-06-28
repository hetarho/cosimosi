/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_Not_AvailableInputs */

const en_test_harness_not_available = /** @type {(inputs: Test_Harness_Not_AvailableInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Not available`)
};

const ko_test_harness_not_available = /** @type {(inputs: Test_Harness_Not_AvailableInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`없음`)
};

/**
* | output |
* | --- |
* | "Not available" |
*
* @param {Test_Harness_Not_AvailableInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_not_available = /** @type {((inputs?: Test_Harness_Not_AvailableInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_Not_AvailableInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_not_available(inputs)
	return ko_test_harness_not_available(inputs)
});