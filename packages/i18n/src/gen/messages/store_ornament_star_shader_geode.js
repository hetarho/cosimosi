/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Store_Ornament_Star_Shader_GeodeInputs */

const en_store_ornament_star_shader_geode = /** @type {(inputs: Store_Ornament_Star_Shader_GeodeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Geode`)
};

const ko_store_ornament_star_shader_geode = /** @type {(inputs: Store_Ornament_Star_Shader_GeodeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`정동석`)
};

/**
* | output |
* | --- |
* | "Geode" |
*
* @param {Store_Ornament_Star_Shader_GeodeInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const store_ornament_star_shader_geode = /** @type {((inputs?: Store_Ornament_Star_Shader_GeodeInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Store_Ornament_Star_Shader_GeodeInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_store_ornament_star_shader_geode(inputs)
	return ko_store_ornament_star_shader_geode(inputs)
});