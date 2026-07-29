/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Store_Ornament_Star_Shader_BubbleInputs */

const en_store_ornament_star_shader_bubble = /** @type {(inputs: Store_Ornament_Star_Shader_BubbleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Bubble`)
};

const ko_store_ornament_star_shader_bubble = /** @type {(inputs: Store_Ornament_Star_Shader_BubbleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`비눗방울`)
};

/**
* | output |
* | --- |
* | "Bubble" |
*
* @param {Store_Ornament_Star_Shader_BubbleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const store_ornament_star_shader_bubble = /** @type {((inputs?: Store_Ornament_Star_Shader_BubbleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Store_Ornament_Star_Shader_BubbleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_store_ornament_star_shader_bubble(inputs)
	return ko_store_ornament_star_shader_bubble(inputs)
});