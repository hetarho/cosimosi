/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_Capability_TransportInputs */

const en_test_harness_capability_transport = /** @type {(inputs: Test_Harness_Capability_TransportInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Transport`)
};

const ko_test_harness_capability_transport = /** @type {(inputs: Test_Harness_Capability_TransportInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Transport`)
};

/**
* | output |
* | --- |
* | "Transport" |
*
* @param {Test_Harness_Capability_TransportInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_capability_transport = /** @type {((inputs?: Test_Harness_Capability_TransportInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_Capability_TransportInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_capability_transport(inputs)
	return ko_test_harness_capability_transport(inputs)
});