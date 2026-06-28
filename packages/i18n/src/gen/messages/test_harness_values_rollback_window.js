/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_Values_Rollback_WindowInputs */

const en_test_harness_values_rollback_window = /** @type {(inputs: Test_Harness_Values_Rollback_WindowInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Optimistic rollback window`)
};

const ko_test_harness_values_rollback_window = /** @type {(inputs: Test_Harness_Values_Rollback_WindowInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Optimistic rollback window`)
};

/**
* | output |
* | --- |
* | "Optimistic rollback window" |
*
* @param {Test_Harness_Values_Rollback_WindowInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_values_rollback_window = /** @type {((inputs?: Test_Harness_Values_Rollback_WindowInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_Values_Rollback_WindowInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_values_rollback_window(inputs)
	return ko_test_harness_values_rollback_window(inputs)
});