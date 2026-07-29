/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Store_Ornament_Star_Shader_FacetInputs */

const en_store_ornament_star_shader_facet = /** @type {(inputs: Store_Ornament_Star_Shader_FacetInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Facet`)
};

const ko_store_ornament_star_shader_facet = /** @type {(inputs: Store_Ornament_Star_Shader_FacetInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`패싯`)
};

/**
* | output |
* | --- |
* | "Facet" |
*
* @param {Store_Ornament_Star_Shader_FacetInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const store_ornament_star_shader_facet = /** @type {((inputs?: Store_Ornament_Star_Shader_FacetInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Store_Ornament_Star_Shader_FacetInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_store_ornament_star_shader_facet(inputs)
	return ko_store_ornament_star_shader_facet(inputs)
});