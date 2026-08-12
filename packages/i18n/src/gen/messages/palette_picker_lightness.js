/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Palette_Picker_LightnessInputs */

const en_palette_picker_lightness = /** @type {(inputs: Palette_Picker_LightnessInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Brightness`)
};

const ko_palette_picker_lightness = /** @type {(inputs: Palette_Picker_LightnessInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`밝기`)
};

/**
* | output |
* | --- |
* | "Brightness" |
*
* @param {Palette_Picker_LightnessInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const palette_picker_lightness = /** @type {((inputs?: Palette_Picker_LightnessInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Palette_Picker_LightnessInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_palette_picker_lightness(inputs)
	return ko_palette_picker_lightness(inputs)
});