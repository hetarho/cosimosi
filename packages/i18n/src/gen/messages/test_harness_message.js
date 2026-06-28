/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_MessageInputs */

const en_test_harness_message = /** @type {(inputs: Test_Harness_MessageInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Message`)
};

const ko_test_harness_message = /** @type {(inputs: Test_Harness_MessageInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`메시지`)
};

/**
* | output |
* | --- |
* | "Message" |
*
* @param {Test_Harness_MessageInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_message = /** @type {((inputs?: Test_Harness_MessageInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_MessageInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_message(inputs)
	return ko_test_harness_message(inputs)
});