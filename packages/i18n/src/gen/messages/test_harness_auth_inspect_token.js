/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_Auth_Inspect_TokenInputs */

const en_test_harness_auth_inspect_token = /** @type {(inputs: Test_Harness_Auth_Inspect_TokenInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Inspect token`)
};

const ko_test_harness_auth_inspect_token = /** @type {(inputs: Test_Harness_Auth_Inspect_TokenInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`토큰 확인`)
};

/**
* | output |
* | --- |
* | "Inspect token" |
*
* @param {Test_Harness_Auth_Inspect_TokenInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_auth_inspect_token = /** @type {((inputs?: Test_Harness_Auth_Inspect_TokenInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_Auth_Inspect_TokenInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_auth_inspect_token(inputs)
	return ko_test_harness_auth_inspect_token(inputs)
});