/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Store_Ornament_Background_LightfallInputs */

const en_store_ornament_background_lightfall = /** @type {(inputs: Store_Ornament_Background_LightfallInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Lightfall`)
};

const ko_store_ornament_background_lightfall = /** @type {(inputs: Store_Ornament_Background_LightfallInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`빛내림`)
};

/**
* | output |
* | --- |
* | "Lightfall" |
*
* @param {Store_Ornament_Background_LightfallInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const store_ornament_background_lightfall = /** @type {((inputs?: Store_Ornament_Background_LightfallInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Store_Ornament_Background_LightfallInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_store_ornament_background_lightfall(inputs)
	return ko_store_ornament_background_lightfall(inputs)
});