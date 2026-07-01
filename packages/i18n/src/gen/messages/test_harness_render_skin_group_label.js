/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_Render_Skin_Group_LabelInputs */

const en_test_harness_render_skin_group_label = /** @type {(inputs: Test_Harness_Render_Skin_Group_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Universe skin`)
};

const ko_test_harness_render_skin_group_label = /** @type {(inputs: Test_Harness_Render_Skin_Group_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`우주 스킨`)
};

/**
* | output |
* | --- |
* | "Universe skin" |
*
* @param {Test_Harness_Render_Skin_Group_LabelInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_render_skin_group_label = /** @type {((inputs?: Test_Harness_Render_Skin_Group_LabelInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_Render_Skin_Group_LabelInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_render_skin_group_label(inputs)
	return ko_test_harness_render_skin_group_label(inputs)
});