/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_Auth_Refresh_SessionInputs */

const en_test_harness_auth_refresh_session = /** @type {(inputs: Test_Harness_Auth_Refresh_SessionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Refresh session`)
};

const ko_test_harness_auth_refresh_session = /** @type {(inputs: Test_Harness_Auth_Refresh_SessionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`세션 갱신`)
};

/**
* | output |
* | --- |
* | "Refresh session" |
*
* @param {Test_Harness_Auth_Refresh_SessionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_auth_refresh_session = /** @type {((inputs?: Test_Harness_Auth_Refresh_SessionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_Auth_Refresh_SessionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_auth_refresh_session(inputs)
	return ko_test_harness_auth_refresh_session(inputs)
});