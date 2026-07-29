/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Store_Ornament_Star_Shader_PlasmaInputs */

const en_store_ornament_star_shader_plasma = /** @type {(inputs: Store_Ornament_Star_Shader_PlasmaInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Plasma`)
};

const ko_store_ornament_star_shader_plasma = /** @type {(inputs: Store_Ornament_Star_Shader_PlasmaInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`플라스마`)
};

/**
* | output |
* | --- |
* | "Plasma" |
*
* @param {Store_Ornament_Star_Shader_PlasmaInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const store_ornament_star_shader_plasma = /** @type {((inputs?: Store_Ornament_Star_Shader_PlasmaInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Store_Ornament_Star_Shader_PlasmaInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_store_ornament_star_shader_plasma(inputs)
	return ko_store_ornament_star_shader_plasma(inputs)
});