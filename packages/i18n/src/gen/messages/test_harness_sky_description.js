/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_Sky_DescriptionInputs */

const en_test_harness_sky_description = /** @type {(inputs: Test_Harness_Sky_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`A shader-lit sphere wrapping the star scene — drag to look around inside it. Thirteen react-bits-derived effects, each sampling the universe's emotion palette; pick an effect and how many emotions it holds. Effects tagged 'adapted' re-create a look their screen-space source can't wear on a sphere.`)
};

const ko_test_harness_sky_description = /** @type {(inputs: Test_Harness_Sky_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`별 장면을 감싸는 셰이더 구 — 드래그해서 내부를 둘러보세요. react-bits 기반 13가지 효과가 각각 우주의 감정 팔레트를 샘플링합니다. 효과와 감정 개수를 고르세요. 'adapted' 태그는 화면공간 원본을 구 표면용으로 재해석한 것입니다.`)
};

/**
* | output |
* | --- |
* | "A shader-lit sphere wrapping the star scene — drag to look around inside it. Thirteen react-bits-derived effects, each sampling the universe's emotion palett..." |
*
* @param {Test_Harness_Sky_DescriptionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_sky_description = /** @type {((inputs?: Test_Harness_Sky_DescriptionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_Sky_DescriptionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_sky_description(inputs)
	return ko_test_harness_sky_description(inputs)
});