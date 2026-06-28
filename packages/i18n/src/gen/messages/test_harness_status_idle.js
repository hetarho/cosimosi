/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_Status_IdleInputs */

const en_test_harness_status_idle = /** @type {(inputs: Test_Harness_Status_IdleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Idle`)
};

const ko_test_harness_status_idle = /** @type {(inputs: Test_Harness_Status_IdleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`대기`)
};

/**
* | output |
* | --- |
* | "Idle" |
*
* @param {Test_Harness_Status_IdleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_status_idle = /** @type {((inputs?: Test_Harness_Status_IdleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_Status_IdleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_status_idle(inputs)
	return ko_test_harness_status_idle(inputs)
});