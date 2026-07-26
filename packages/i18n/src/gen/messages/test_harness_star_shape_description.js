/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_Star_Shape_DescriptionInputs */

const en_test_harness_star_shape_description = /** @type {(inputs: Test_Harness_Star_Shape_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`One star per emotion, and a candidate look to try on all of them at once. Pick a shape and the whole field takes it, with size and brightness held equal so form and feeling are the only things changing. Drag to tumble, wheel to fly in.`)
};

const ko_test_harness_star_shape_description = /** @type {(inputs: Test_Harness_Star_Shape_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`감정마다 별 하나씩 띄운 우주에 후보 모습을 입혀 봅니다. 버튼을 누르면 열세 개가 한꺼번에 그 모양이 되고, 크기와 밝기는 똑같이 두어 형태와 감정만 달라집니다. 드래그로 돌리고 휠로 다가갑니다.`)
};

/**
* | output |
* | --- |
* | "One star per emotion, and a candidate look to try on all of them at once. Pick a shape and the whole field takes it, with size and brightness held equal so f..." |
*
* @param {Test_Harness_Star_Shape_DescriptionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_star_shape_description = /** @type {((inputs?: Test_Harness_Star_Shape_DescriptionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_Star_Shape_DescriptionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_star_shape_description(inputs)
	return ko_test_harness_star_shape_description(inputs)
});