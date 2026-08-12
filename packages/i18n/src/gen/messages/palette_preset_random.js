/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Palette_Preset_RandomInputs */

const en_palette_preset_random = /** @type {(inputs: Palette_Preset_RandomInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Random`)
};

const ko_palette_preset_random = /** @type {(inputs: Palette_Preset_RandomInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`무작위`)
};

/**
* | output |
* | --- |
* | "Random" |
*
* @param {Palette_Preset_RandomInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const palette_preset_random = /** @type {((inputs?: Palette_Preset_RandomInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Palette_Preset_RandomInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_palette_preset_random(inputs)
	return ko_palette_preset_random(inputs)
});