/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_Nebula_Force_WebglInputs */

const en_test_harness_nebula_force_webgl = /** @type {(inputs: Test_Harness_Nebula_Force_WebglInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Force WebGL2 fallback`)
};

const ko_test_harness_nebula_force_webgl = /** @type {(inputs: Test_Harness_Nebula_Force_WebglInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`WebGL2 폴백 강제`)
};

/**
* | output |
* | --- |
* | "Force WebGL2 fallback" |
*
* @param {Test_Harness_Nebula_Force_WebglInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_nebula_force_webgl = /** @type {((inputs?: Test_Harness_Nebula_Force_WebglInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_Nebula_Force_WebglInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_nebula_force_webgl(inputs)
	return ko_test_harness_nebula_force_webgl(inputs)
});