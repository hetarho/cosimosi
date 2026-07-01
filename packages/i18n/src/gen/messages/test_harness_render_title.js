/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_Render_TitleInputs */

const en_test_harness_render_title = /** @type {(inputs: Test_Harness_Render_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Rendering foundation`)
};

const ko_test_harness_render_title = /** @type {(inputs: Test_Harness_Render_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`렌더링 파운데이션`)
};

/**
* | output |
* | --- |
* | "Rendering foundation" |
*
* @param {Test_Harness_Render_TitleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_render_title = /** @type {((inputs?: Test_Harness_Render_TitleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_Render_TitleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_render_title(inputs)
	return ko_test_harness_render_title(inputs)
});