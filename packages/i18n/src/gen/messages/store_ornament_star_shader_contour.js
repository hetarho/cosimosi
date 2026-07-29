/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Store_Ornament_Star_Shader_ContourInputs */

const en_store_ornament_star_shader_contour = /** @type {(inputs: Store_Ornament_Star_Shader_ContourInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Contour`)
};

const ko_store_ornament_star_shader_contour = /** @type {(inputs: Store_Ornament_Star_Shader_ContourInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`등고선`)
};

/**
* | output |
* | --- |
* | "Contour" |
*
* @param {Store_Ornament_Star_Shader_ContourInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const store_ornament_star_shader_contour = /** @type {((inputs?: Store_Ornament_Star_Shader_ContourInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Store_Ornament_Star_Shader_ContourInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_store_ornament_star_shader_contour(inputs)
	return ko_store_ornament_star_shader_contour(inputs)
});