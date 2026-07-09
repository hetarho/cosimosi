/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_Sky_DescriptionInputs */

const en_test_harness_sky_description = /** @type {(inputs: Test_Harness_Sky_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`A shader-lit sphere wrapping the star scene — drag to look around inside it. The emotion palette (and the effect) reshape with the count. Faithful TSL port of react-bits' Grainient (reference; the rest follow once the direction is confirmed).`)
};

const ko_test_harness_sky_description = /** @type {(inputs: Test_Harness_Sky_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`별 장면을 감싸는 셰이더 구 — 드래그해서 내부를 둘러보세요. 감정 개수에 따라 팔레트와 효과가 바뀝니다. react-bits Grainient를 TSL로 충실히 포팅한 레퍼런스입니다(방향 확정 후 나머지 진행).`)
};

/**
* | output |
* | --- |
* | "A shader-lit sphere wrapping the star scene — drag to look around inside it. The emotion palette (and the effect) reshape with the count. Faithful TSL port o..." |
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