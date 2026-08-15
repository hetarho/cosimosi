/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Store_Ornament_Gist_Shader_EchoInputs */

const en_store_ornament_gist_shader_echo = /** @type {(inputs: Store_Ornament_Gist_Shader_EchoInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Echo`)
};

const ko_store_ornament_gist_shader_echo = /** @type {(inputs: Store_Ornament_Gist_Shader_EchoInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`메아리`)
};

/**
* | output |
* | --- |
* | "Echo" |
*
* @param {Store_Ornament_Gist_Shader_EchoInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const store_ornament_gist_shader_echo = /** @type {((inputs?: Store_Ornament_Gist_Shader_EchoInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Store_Ornament_Gist_Shader_EchoInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_store_ornament_gist_shader_echo(inputs)
	return ko_store_ornament_gist_shader_echo(inputs)
});