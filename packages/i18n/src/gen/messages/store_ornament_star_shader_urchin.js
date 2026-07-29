/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Store_Ornament_Star_Shader_UrchinInputs */

const en_store_ornament_star_shader_urchin = /** @type {(inputs: Store_Ornament_Star_Shader_UrchinInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Urchin`)
};

const ko_store_ornament_star_shader_urchin = /** @type {(inputs: Store_Ornament_Star_Shader_UrchinInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`성게`)
};

/**
* | output |
* | --- |
* | "Urchin" |
*
* @param {Store_Ornament_Star_Shader_UrchinInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const store_ornament_star_shader_urchin = /** @type {((inputs?: Store_Ornament_Star_Shader_UrchinInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Store_Ornament_Star_Shader_UrchinInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_store_ornament_star_shader_urchin(inputs)
	return ko_store_ornament_star_shader_urchin(inputs)
});