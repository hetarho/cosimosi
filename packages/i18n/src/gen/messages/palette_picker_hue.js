/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Palette_Picker_HueInputs */

const en_palette_picker_hue = /** @type {(inputs: Palette_Picker_HueInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Hue`)
};

const ko_palette_picker_hue = /** @type {(inputs: Palette_Picker_HueInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`색상`)
};

/**
* | output |
* | --- |
* | "Hue" |
*
* @param {Palette_Picker_HueInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const palette_picker_hue = /** @type {((inputs?: Palette_Picker_HueInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Palette_Picker_HueInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_palette_picker_hue(inputs)
	return ko_palette_picker_hue(inputs)
});