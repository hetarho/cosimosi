/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Store_Ornament_Gist_Shader_BeadInputs */

const en_store_ornament_gist_shader_bead = /** @type {(inputs: Store_Ornament_Gist_Shader_BeadInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Bead`)
};

const ko_store_ornament_gist_shader_bead = /** @type {(inputs: Store_Ornament_Gist_Shader_BeadInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`구슬`)
};

/**
* | output |
* | --- |
* | "Bead" |
*
* @param {Store_Ornament_Gist_Shader_BeadInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const store_ornament_gist_shader_bead = /** @type {((inputs?: Store_Ornament_Gist_Shader_BeadInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Store_Ornament_Gist_Shader_BeadInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_store_ornament_gist_shader_bead(inputs)
	return ko_store_ornament_gist_shader_bead(inputs)
});