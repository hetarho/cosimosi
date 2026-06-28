/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_Route_BadgeInputs */

const en_test_harness_route_badge = /** @type {(inputs: Test_Harness_Route_BadgeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`/test`)
};

const ko_test_harness_route_badge = /** @type {(inputs: Test_Harness_Route_BadgeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`/test`)
};

/**
* | output |
* | --- |
* | "/test" |
*
* @param {Test_Harness_Route_BadgeInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_route_badge = /** @type {((inputs?: Test_Harness_Route_BadgeInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_Route_BadgeInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_route_badge(inputs)
	return ko_test_harness_route_badge(inputs)
});