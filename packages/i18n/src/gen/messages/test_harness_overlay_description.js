/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_Overlay_DescriptionInputs */

const en_test_harness_overlay_description = /** @type {(inputs: Test_Harness_Overlay_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Buttons, a HUD, and a modal floating over the live 3D universe — testing 2D chrome legibility against the moving background.`)
};

const ko_test_harness_overlay_description = /** @type {(inputs: Test_Harness_Overlay_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`실시간 3D 우주 위에 버튼·HUD·모달을 띄워 배경 위 2D 크롬의 가독성을 확인합니다.`)
};

/**
* | output |
* | --- |
* | "Buttons, a HUD, and a modal floating over the live 3D universe — testing 2D chrome legibility against the moving background." |
*
* @param {Test_Harness_Overlay_DescriptionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_overlay_description = /** @type {((inputs?: Test_Harness_Overlay_DescriptionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_Overlay_DescriptionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_overlay_description(inputs)
	return ko_test_harness_overlay_description(inputs)
});