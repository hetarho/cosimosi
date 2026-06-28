/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_Auth_StatusInputs */

const en_test_harness_auth_status = /** @type {(inputs: Test_Harness_Auth_StatusInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Session status`)
};

const ko_test_harness_auth_status = /** @type {(inputs: Test_Harness_Auth_StatusInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Session status`)
};

/**
* | output |
* | --- |
* | "Session status" |
*
* @param {Test_Harness_Auth_StatusInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_auth_status = /** @type {((inputs?: Test_Harness_Auth_StatusInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_Auth_StatusInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_auth_status(inputs)
	return ko_test_harness_auth_status(inputs)
});