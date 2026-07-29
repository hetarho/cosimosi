/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Store_Ornament_Star_Shader_PrismInputs */

const en_store_ornament_star_shader_prism = /** @type {(inputs: Store_Ornament_Star_Shader_PrismInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Prism`)
};

const ko_store_ornament_star_shader_prism = /** @type {(inputs: Store_Ornament_Star_Shader_PrismInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`프리즘`)
};

/**
* | output |
* | --- |
* | "Prism" |
*
* @param {Store_Ornament_Star_Shader_PrismInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const store_ornament_star_shader_prism = /** @type {((inputs?: Store_Ornament_Star_Shader_PrismInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Store_Ornament_Star_Shader_PrismInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_store_ornament_star_shader_prism(inputs)
	return ko_store_ornament_star_shader_prism(inputs)
});