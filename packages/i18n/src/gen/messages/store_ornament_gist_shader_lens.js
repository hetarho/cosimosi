/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Store_Ornament_Gist_Shader_LensInputs */

const en_store_ornament_gist_shader_lens = /** @type {(inputs: Store_Ornament_Gist_Shader_LensInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Lens`)
};

const ko_store_ornament_gist_shader_lens = /** @type {(inputs: Store_Ornament_Gist_Shader_LensInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`렌즈 빛`)
};

/**
* | output |
* | --- |
* | "Lens" |
*
* @param {Store_Ornament_Gist_Shader_LensInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const store_ornament_gist_shader_lens = /** @type {((inputs?: Store_Ornament_Gist_Shader_LensInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Store_Ornament_Gist_Shader_LensInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_store_ornament_gist_shader_lens(inputs)
	return ko_store_ornament_gist_shader_lens(inputs)
});