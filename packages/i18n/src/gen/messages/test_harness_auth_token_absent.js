/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_Auth_Token_AbsentInputs */

const en_test_harness_auth_token_absent = /** @type {(inputs: Test_Harness_Auth_Token_AbsentInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Absent`)
};

const ko_test_harness_auth_token_absent = /** @type {(inputs: Test_Harness_Auth_Token_AbsentInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`없음`)
};

/**
* | output |
* | --- |
* | "Absent" |
*
* @param {Test_Harness_Auth_Token_AbsentInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_auth_token_absent = /** @type {((inputs?: Test_Harness_Auth_Token_AbsentInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_Auth_Token_AbsentInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_auth_token_absent(inputs)
	return ko_test_harness_auth_token_absent(inputs)
});