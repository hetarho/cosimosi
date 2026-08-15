/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Store_Ornament_Gist_Shader_PearlInputs */

const en_store_ornament_gist_shader_pearl = /** @type {(inputs: Store_Ornament_Gist_Shader_PearlInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Pearl`)
};

const ko_store_ornament_gist_shader_pearl = /** @type {(inputs: Store_Ornament_Gist_Shader_PearlInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`진주`)
};

/**
* | output |
* | --- |
* | "Pearl" |
*
* @param {Store_Ornament_Gist_Shader_PearlInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const store_ornament_gist_shader_pearl = /** @type {((inputs?: Store_Ornament_Gist_Shader_PearlInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Store_Ornament_Gist_Shader_PearlInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_store_ornament_gist_shader_pearl(inputs)
	return ko_store_ornament_gist_shader_pearl(inputs)
});