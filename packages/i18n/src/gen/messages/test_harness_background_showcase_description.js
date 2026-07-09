/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_Background_Showcase_DescriptionInputs */

const en_test_harness_background_showcase_description = /** @type {(inputs: Test_Harness_Background_Showcase_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Autonomous shader skies inspired by react-bits — each carries the universe's emotions and restructures by their count. The same effect is shown holding 1 / 3 / 5 / 7 emotions.`)
};

const ko_test_harness_background_showcase_description = /** @type {(inputs: Test_Harness_Background_Showcase_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`react-bits에서 영감받은 자율 셰이더 하늘 — 각 배경은 우주의 감정을 담고 그 개수에 따라 구조가 바뀝니다. 같은 효과를 감정 1 / 3 / 5 / 7개로 보여줍니다.`)
};

/**
* | output |
* | --- |
* | "Autonomous shader skies inspired by react-bits — each carries the universe's emotions and restructures by their count. The same effect is shown holding 1 / 3..." |
*
* @param {Test_Harness_Background_Showcase_DescriptionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_background_showcase_description = /** @type {((inputs?: Test_Harness_Background_Showcase_DescriptionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_Background_Showcase_DescriptionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_background_showcase_description(inputs)
	return ko_test_harness_background_showcase_description(inputs)
});