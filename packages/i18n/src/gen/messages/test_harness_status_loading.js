/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_Status_LoadingInputs */

const en_test_harness_status_loading = /** @type {(inputs: Test_Harness_Status_LoadingInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Loading…`)
};

const ko_test_harness_status_loading = /** @type {(inputs: Test_Harness_Status_LoadingInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`불러오는 중…`)
};

/**
* | output |
* | --- |
* | "Loading…" |
*
* @param {Test_Harness_Status_LoadingInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_status_loading = /** @type {((inputs?: Test_Harness_Status_LoadingInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_Status_LoadingInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_status_loading(inputs)
	return ko_test_harness_status_loading(inputs)
});