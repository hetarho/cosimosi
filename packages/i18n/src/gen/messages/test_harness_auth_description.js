/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_Auth_DescriptionInputs */

const en_test_harness_auth_description = /** @type {(inputs: Test_Harness_Auth_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Inspects the session facade and token accessor without exposing token contents.`)
};

const ko_test_harness_auth_description = /** @type {(inputs: Test_Harness_Auth_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`토큰 내용을 노출하지 않고 session facade와 token accessor를 확인합니다.`)
};

/**
* | output |
* | --- |
* | "Inspects the session facade and token accessor without exposing token contents." |
*
* @param {Test_Harness_Auth_DescriptionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_auth_description = /** @type {((inputs?: Test_Harness_Auth_DescriptionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_Auth_DescriptionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_auth_description(inputs)
	return ko_test_harness_auth_description(inputs)
});