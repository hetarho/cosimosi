/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Test_Harness_Star_Shape_Facet_DescriptionInputs */

const en_test_harness_star_shape_facet_description = /** @type {(inputs: Test_Harness_Star_Shape_Facet_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Twenty quiet facets, as though a small moon were cut by hand.`)
};

const ko_test_harness_star_shape_facet_description = /** @type {(inputs: Test_Harness_Star_Shape_Facet_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`스무 개의 고요한 면이 손으로 깎은 작은 달처럼 빛납니다.`)
};

/**
* | output |
* | --- |
* | "Twenty quiet facets, as though a small moon were cut by hand." |
*
* @param {Test_Harness_Star_Shape_Facet_DescriptionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const test_harness_star_shape_facet_description = /** @type {((inputs?: Test_Harness_Star_Shape_Facet_DescriptionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Test_Harness_Star_Shape_Facet_DescriptionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_test_harness_star_shape_facet_description(inputs)
	return ko_test_harness_star_shape_facet_description(inputs)
});