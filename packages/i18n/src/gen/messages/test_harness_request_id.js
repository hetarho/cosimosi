/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_Request_IdInputs */

const en_test_harness_request_id = /** @type {(inputs: Test_Harness_Request_IdInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Request ID`)
};

const ko_test_harness_request_id = /** @type {(inputs: Test_Harness_Request_IdInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Request ID`)
};

/**
* | output |
* | --- |
* | "Request ID" |
*
* @param {Test_Harness_Request_IdInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_request_id = /** @type {((inputs?: Test_Harness_Request_IdInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_Request_IdInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_request_id(inputs)
	return ko_test_harness_request_id(inputs)
});