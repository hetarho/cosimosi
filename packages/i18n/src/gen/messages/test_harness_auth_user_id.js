/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_Auth_User_IdInputs */

const en_test_harness_auth_user_id = /** @type {(inputs: Test_Harness_Auth_User_IdInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`User ID`)
};

const ko_test_harness_auth_user_id = /** @type {(inputs: Test_Harness_Auth_User_IdInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`User ID`)
};

/**
* | output |
* | --- |
* | "User ID" |
*
* @param {Test_Harness_Auth_User_IdInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_auth_user_id = /** @type {((inputs?: Test_Harness_Auth_User_IdInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_Auth_User_IdInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_auth_user_id(inputs)
	return ko_test_harness_auth_user_id(inputs)
});