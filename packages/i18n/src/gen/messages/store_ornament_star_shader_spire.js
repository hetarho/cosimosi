/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Store_Ornament_Star_Shader_SpireInputs */

const en_store_ornament_star_shader_spire = /** @type {(inputs: Store_Ornament_Star_Shader_SpireInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Spire`)
};

const ko_store_ornament_star_shader_spire = /** @type {(inputs: Store_Ornament_Star_Shader_SpireInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`첨탑`)
};

/**
* | output |
* | --- |
* | "Spire" |
*
* @param {Store_Ornament_Star_Shader_SpireInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const store_ornament_star_shader_spire = /** @type {((inputs?: Store_Ornament_Star_Shader_SpireInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Store_Ornament_Star_Shader_SpireInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_store_ornament_star_shader_spire(inputs)
	return ko_store_ornament_star_shader_spire(inputs)
});