/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_Auth_Expires_AtInputs */

const en_test_harness_auth_expires_at = /** @type {(inputs: Test_Harness_Auth_Expires_AtInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Expires at`)
};

const ko_test_harness_auth_expires_at = /** @type {(inputs: Test_Harness_Auth_Expires_AtInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Expires at`)
};

/**
* | output |
* | --- |
* | "Expires at" |
*
* @param {Test_Harness_Auth_Expires_AtInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_auth_expires_at = /** @type {((inputs?: Test_Harness_Auth_Expires_AtInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_Auth_Expires_AtInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_auth_expires_at(inputs)
	return ko_test_harness_auth_expires_at(inputs)
});