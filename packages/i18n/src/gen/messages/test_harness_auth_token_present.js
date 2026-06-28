/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_Auth_Token_PresentInputs */

const en_test_harness_auth_token_present = /** @type {(inputs: Test_Harness_Auth_Token_PresentInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Present`)
};

const ko_test_harness_auth_token_present = /** @type {(inputs: Test_Harness_Auth_Token_PresentInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`있음`)
};

/**
* | output |
* | --- |
* | "Present" |
*
* @param {Test_Harness_Auth_Token_PresentInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_auth_token_present = /** @type {((inputs?: Test_Harness_Auth_Token_PresentInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_Auth_Token_PresentInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_auth_token_present(inputs)
	return ko_test_harness_auth_token_present(inputs)
});