/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_Capability_AuthInputs */

const en_test_harness_capability_auth = /** @type {(inputs: Test_Harness_Capability_AuthInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Auth`)
};

const ko_test_harness_capability_auth = /** @type {(inputs: Test_Harness_Capability_AuthInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Auth`)
};

/**
* | output |
* | --- |
* | "Auth" |
*
* @param {Test_Harness_Capability_AuthInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_capability_auth = /** @type {((inputs?: Test_Harness_Capability_AuthInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_Capability_AuthInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_capability_auth(inputs)
	return ko_test_harness_capability_auth(inputs)
});