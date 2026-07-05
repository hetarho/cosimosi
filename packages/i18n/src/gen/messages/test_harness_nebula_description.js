/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_Nebula_DescriptionInputs */

const en_test_harness_nebula_description = /** @type {(inputs: Test_Harness_Nebula_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Many mood colors coexisting and bleeding — a stronger star bleeds wider. Drawn through the real palette seam, exercising the WebGL2 fallback.`)
};

const ko_test_harness_nebula_description = /** @type {(inputs: Test_Harness_Nebula_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`여러 감정 색이 겹치고 번지는 성운 — 별이 강할수록 넓게 물듭니다. 실제 팔레트 seam으로 그리고 WebGL2 폴백을 확인합니다.`)
};

/**
* | output |
* | --- |
* | "Many mood colors coexisting and bleeding — a stronger star bleeds wider. Drawn through the real palette seam, exercising the WebGL2 fallback." |
*
* @param {Test_Harness_Nebula_DescriptionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_nebula_description = /** @type {((inputs?: Test_Harness_Nebula_DescriptionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_Nebula_DescriptionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_nebula_description(inputs)
	return ko_test_harness_nebula_description(inputs)
});