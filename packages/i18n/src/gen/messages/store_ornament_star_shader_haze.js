/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Store_Ornament_Star_Shader_HazeInputs */

const en_store_ornament_star_shader_haze = /** @type {(inputs: Store_Ornament_Star_Shader_HazeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Haze`)
};

const ko_store_ornament_star_shader_haze = /** @type {(inputs: Store_Ornament_Star_Shader_HazeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`아지랑이`)
};

/**
* | output |
* | --- |
* | "Haze" |
*
* @param {Store_Ornament_Star_Shader_HazeInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const store_ornament_star_shader_haze = /** @type {((inputs?: Store_Ornament_Star_Shader_HazeInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Store_Ornament_Star_Shader_HazeInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_store_ornament_star_shader_haze(inputs)
	return ko_store_ornament_star_shader_haze(inputs)
});