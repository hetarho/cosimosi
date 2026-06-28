/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_No_PanelsInputs */

const en_test_harness_no_panels = /** @type {(inputs: Test_Harness_No_PanelsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`No verification panels are registered.`)
};

const ko_test_harness_no_panels = /** @type {(inputs: Test_Harness_No_PanelsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`등록된 검증 패널이 없습니다.`)
};

/**
* | output |
* | --- |
* | "No verification panels are registered." |
*
* @param {Test_Harness_No_PanelsInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_no_panels = /** @type {((inputs?: Test_Harness_No_PanelsInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_No_PanelsInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_no_panels(inputs)
	return ko_test_harness_no_panels(inputs)
});