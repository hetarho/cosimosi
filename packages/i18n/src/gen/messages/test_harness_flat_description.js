/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_Flat_DescriptionInputs */

const en_test_harness_flat_description = /** @type {(inputs: Test_Harness_Flat_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`A composed screen built entirely from 2D primitives — no 3D — to judge layout, hierarchy, and rhythm on their own.`)
};

const ko_test_harness_flat_description = /** @type {(inputs: Test_Harness_Flat_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`3D 없이 2D primitive만으로 구성한 화면 — 레이아웃·위계·리듬을 그 자체로 판단합니다.`)
};

/**
* | output |
* | --- |
* | "A composed screen built entirely from 2D primitives — no 3D — to judge layout, hierarchy, and rhythm on their own." |
*
* @param {Test_Harness_Flat_DescriptionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_flat_description = /** @type {((inputs?: Test_Harness_Flat_DescriptionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_Flat_DescriptionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_flat_description(inputs)
	return ko_test_harness_flat_description(inputs)
});