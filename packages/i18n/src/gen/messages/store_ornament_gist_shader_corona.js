/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Store_Ornament_Gist_Shader_CoronaInputs */

const en_store_ornament_gist_shader_corona = /** @type {(inputs: Store_Ornament_Gist_Shader_CoronaInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Corona`)
};

const ko_store_ornament_gist_shader_corona = /** @type {(inputs: Store_Ornament_Gist_Shader_CoronaInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`코로나`)
};

/**
* | output |
* | --- |
* | "Corona" |
*
* @param {Store_Ornament_Gist_Shader_CoronaInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const store_ornament_gist_shader_corona = /** @type {((inputs?: Store_Ornament_Gist_Shader_CoronaInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Store_Ornament_Gist_Shader_CoronaInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_store_ornament_gist_shader_corona(inputs)
	return ko_store_ornament_gist_shader_corona(inputs)
});