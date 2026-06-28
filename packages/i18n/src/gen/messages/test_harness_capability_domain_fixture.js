/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_Capability_Domain_FixtureInputs */

const en_test_harness_capability_domain_fixture = /** @type {(inputs: Test_Harness_Capability_Domain_FixtureInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Domain fixture`)
};

const ko_test_harness_capability_domain_fixture = /** @type {(inputs: Test_Harness_Capability_Domain_FixtureInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Domain fixture`)
};

/**
* | output |
* | --- |
* | "Domain fixture" |
*
* @param {Test_Harness_Capability_Domain_FixtureInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_capability_domain_fixture = /** @type {((inputs?: Test_Harness_Capability_Domain_FixtureInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_Capability_Domain_FixtureInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_capability_domain_fixture(inputs)
	return ko_test_harness_capability_domain_fixture(inputs)
});