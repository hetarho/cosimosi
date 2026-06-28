/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_Transport_DescriptionInputs */

const en_test_harness_transport_description = /** @type {(inputs: Test_Harness_Transport_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Calls PlatformService.Ping through the app transport context.`)
};

const ko_test_harness_transport_description = /** @type {(inputs: Test_Harness_Transport_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`앱 transport context를 통해 PlatformService.Ping을 호출합니다.`)
};

/**
* | output |
* | --- |
* | "Calls PlatformService.Ping through the app transport context." |
*
* @param {Test_Harness_Transport_DescriptionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_transport_description = /** @type {((inputs?: Test_Harness_Transport_DescriptionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_Transport_DescriptionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_transport_description(inputs)
	return ko_test_harness_transport_description(inputs)
});