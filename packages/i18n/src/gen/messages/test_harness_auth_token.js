/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_Auth_TokenInputs */

const en_test_harness_auth_token = /** @type {(inputs: Test_Harness_Auth_TokenInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Access token`)
};

const ko_test_harness_auth_token = /** @type {(inputs: Test_Harness_Auth_TokenInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Access token`)
};

/**
* | output |
* | --- |
* | "Access token" |
*
* @param {Test_Harness_Auth_TokenInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_auth_token = /** @type {((inputs?: Test_Harness_Auth_TokenInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_Auth_TokenInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_auth_token(inputs)
	return ko_test_harness_auth_token(inputs)
});