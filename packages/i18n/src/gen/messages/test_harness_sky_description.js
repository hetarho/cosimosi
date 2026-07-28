/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_Sky_DescriptionInputs */

const en_test_harness_sky_description = /** @type {(inputs: Test_Harness_Sky_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`A shader-lit sphere wrapping the star scene — drag to look around inside it. Twelve skies, each a different arrangement of domain, field, emotion partition and finish; every colour comes from the universe's own feelings. Hand any sky any number of emotions — more feelings means smaller territories, never a muddier wash.`)
};

const ko_test_harness_sky_description = /** @type {(inputs: Test_Harness_Sky_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`별 장면을 감싸는 셰이더 구 — 드래그해서 내부를 둘러보세요. 열두 가지 하늘이 각각 정의역·필드·감정 분할·마감을 다르게 조합한 것이고, 색은 모두 우주의 감정에서 옵니다. 감정 개수는 어느 하늘에서든 자유롭게 골라 보세요 — 감정이 많아지면 영역이 작아질 뿐, 탁해지지 않습니다.`)
};

/**
* | output |
* | --- |
* | "A shader-lit sphere wrapping the star scene — drag to look around inside it. Twelve skies, each a different arrangement of domain, field, emotion partition a..." |
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