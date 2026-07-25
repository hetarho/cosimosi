/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_Ui_Test_DescriptionInputs */

const en_test_harness_ui_test_description = /** @type {(inputs: Test_Harness_Ui_Test_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`The live 3D universe with real product chrome floating over it: drive the emotions present in the field, swap the sky, and see how glass reads against a scene that is actually moving. The 2D language itself lives on the design showcase at /design.`)
};

const ko_test_harness_ui_test_description = /** @type {(inputs: Test_Harness_Ui_Test_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`살아 있는 3D 우주 위에 실제 제품 크롬을 띄운 화면입니다. 우주에 존재하는 감정을 조절하고 하늘을 바꿔가며, 실제로 움직이는 장면 위에서 글래스가 어떻게 읽히는지 확인합니다. 2D 언어 자체는 /design 쇼케이스에 있습니다.`)
};

/**
* | output |
* | --- |
* | "The live 3D universe with real product chrome floating over it: drive the emotions present in the field, swap the sky, and see how glass reads against a scen..." |
*
* @param {Test_Harness_Ui_Test_DescriptionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_ui_test_description = /** @type {((inputs?: Test_Harness_Ui_Test_DescriptionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_Ui_Test_DescriptionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_ui_test_description(inputs)
	return ko_test_harness_ui_test_description(inputs)
});