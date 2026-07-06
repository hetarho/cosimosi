/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_Overlay_TitleInputs */

const en_test_harness_overlay_title = /** @type {(inputs: Test_Harness_Overlay_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`UI over universe`)
};

const ko_test_harness_overlay_title = /** @type {(inputs: Test_Harness_Overlay_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`우주 위 UI`)
};

/**
* | output |
* | --- |
* | "UI over universe" |
*
* @param {Test_Harness_Overlay_TitleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_overlay_title = /** @type {((inputs?: Test_Harness_Overlay_TitleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_Overlay_TitleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_overlay_title(inputs)
	return ko_test_harness_overlay_title(inputs)
});