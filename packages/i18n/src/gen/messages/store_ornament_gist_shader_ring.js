/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Store_Ornament_Gist_Shader_RingInputs */

const en_store_ornament_gist_shader_ring = /** @type {(inputs: Store_Ornament_Gist_Shader_RingInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Ring`)
};

const ko_store_ornament_gist_shader_ring = /** @type {(inputs: Store_Ornament_Gist_Shader_RingInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`고리`)
};

/**
* | output |
* | --- |
* | "Ring" |
*
* @param {Store_Ornament_Gist_Shader_RingInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const store_ornament_gist_shader_ring = /** @type {((inputs?: Store_Ornament_Gist_Shader_RingInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Store_Ornament_Gist_Shader_RingInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_store_ornament_gist_shader_ring(inputs)
	return ko_store_ornament_gist_shader_ring(inputs)
});