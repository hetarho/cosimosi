/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_Transport_Ping_ActionInputs */

const en_test_harness_transport_ping_action = /** @type {(inputs: Test_Harness_Transport_Ping_ActionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Ping transport`)
};

const ko_test_harness_transport_ping_action = /** @type {(inputs: Test_Harness_Transport_Ping_ActionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Transport ping`)
};

/**
* | output |
* | --- |
* | "Ping transport" |
*
* @param {Test_Harness_Transport_Ping_ActionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_transport_ping_action = /** @type {((inputs?: Test_Harness_Transport_Ping_ActionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_Transport_Ping_ActionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_transport_ping_action(inputs)
	return ko_test_harness_transport_ping_action(inputs)
});