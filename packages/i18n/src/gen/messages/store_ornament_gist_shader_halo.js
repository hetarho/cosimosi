/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Store_Ornament_Gist_Shader_HaloInputs */

const en_store_ornament_gist_shader_halo = /** @type {(inputs: Store_Ornament_Gist_Shader_HaloInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Halo`)
};

const ko_store_ornament_gist_shader_halo = /** @type {(inputs: Store_Ornament_Gist_Shader_HaloInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`후광`)
};

/**
* | output |
* | --- |
* | "Halo" |
*
* @param {Store_Ornament_Gist_Shader_HaloInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const store_ornament_gist_shader_halo = /** @type {((inputs?: Store_Ornament_Gist_Shader_HaloInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Store_Ornament_Gist_Shader_HaloInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_store_ornament_gist_shader_halo(inputs)
	return ko_store_ornament_gist_shader_halo(inputs)
});