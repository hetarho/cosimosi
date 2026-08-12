/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Palette_Preset_Popular_FirstInputs */

const en_palette_preset_popular_first = /** @type {(inputs: Palette_Preset_Popular_FirstInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Most chosen`)
};

const ko_palette_preset_popular_first = /** @type {(inputs: Palette_Preset_Popular_FirstInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`가장 많이 고른 색`)
};

/**
* | output |
* | --- |
* | "Most chosen" |
*
* @param {Palette_Preset_Popular_FirstInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const palette_preset_popular_first = /** @type {((inputs?: Palette_Preset_Popular_FirstInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Palette_Preset_Popular_FirstInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_palette_preset_popular_first(inputs)
	return ko_palette_preset_popular_first(inputs)
});