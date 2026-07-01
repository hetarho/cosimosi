/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_Render_DescriptionInputs */

const en_test_harness_render_description = /** @type {(inputs: Test_Harness_Render_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Skinned universe background, instanced bodies, and a bloom pass on the WebGPU renderer (WebGL2 fallback). Switch skins live.`)
};

const ko_test_harness_render_description = /** @type {(inputs: Test_Harness_Render_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`WebGPU 렌더러(WebGL2 폴백) 위의 스킨 배경 · 인스턴스 바디 · 블룸 패스. 스킨 실시간 전환.`)
};

/**
* | output |
* | --- |
* | "Skinned universe background, instanced bodies, and a bloom pass on the WebGPU renderer (WebGL2 fallback). Switch skins live." |
*
* @param {Test_Harness_Render_DescriptionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_render_description = /** @type {((inputs?: Test_Harness_Render_DescriptionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_Render_DescriptionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_render_description(inputs)
	return ko_test_harness_render_description(inputs)
});