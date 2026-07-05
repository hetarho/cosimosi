/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_Nebula_Use_WebgpuInputs */

const en_test_harness_nebula_use_webgpu = /** @type {(inputs: Test_Harness_Nebula_Use_WebgpuInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Use WebGPU`)
};

const ko_test_harness_nebula_use_webgpu = /** @type {(inputs: Test_Harness_Nebula_Use_WebgpuInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`WebGPU 사용`)
};

/**
* | output |
* | --- |
* | "Use WebGPU" |
*
* @param {Test_Harness_Nebula_Use_WebgpuInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_nebula_use_webgpu = /** @type {((inputs?: Test_Harness_Nebula_Use_WebgpuInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_Nebula_Use_WebgpuInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_nebula_use_webgpu(inputs)
	return ko_test_harness_nebula_use_webgpu(inputs)
});