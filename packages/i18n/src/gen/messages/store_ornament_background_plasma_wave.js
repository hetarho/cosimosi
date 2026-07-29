/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Store_Ornament_Background_Plasma_WaveInputs */

const en_store_ornament_background_plasma_wave = /** @type {(inputs: Store_Ornament_Background_Plasma_WaveInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Plasma Wave`)
};

const ko_store_ornament_background_plasma_wave = /** @type {(inputs: Store_Ornament_Background_Plasma_WaveInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`플라스마 물결`)
};

/**
* | output |
* | --- |
* | "Plasma Wave" |
*
* @param {Store_Ornament_Background_Plasma_WaveInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const store_ornament_background_plasma_wave = /** @type {((inputs?: Store_Ornament_Background_Plasma_WaveInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Store_Ornament_Background_Plasma_WaveInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_store_ornament_background_plasma_wave(inputs)
	return ko_store_ornament_background_plasma_wave(inputs)
});