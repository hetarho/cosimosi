/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_Server_TimeInputs */

const en_test_harness_server_time = /** @type {(inputs: Test_Harness_Server_TimeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Server time`)
};

const ko_test_harness_server_time = /** @type {(inputs: Test_Harness_Server_TimeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`서버 시간`)
};

/**
* | output |
* | --- |
* | "Server time" |
*
* @param {Test_Harness_Server_TimeInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_server_time = /** @type {((inputs?: Test_Harness_Server_TimeInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_Server_TimeInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_server_time(inputs)
	return ko_test_harness_server_time(inputs)
});