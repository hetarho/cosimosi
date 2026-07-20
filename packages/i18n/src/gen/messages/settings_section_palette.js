/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Settings_Section_PaletteInputs */

const en_settings_section_palette = /** @type {(inputs: Settings_Section_PaletteInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Palette`)
};

const ko_settings_section_palette = /** @type {(inputs: Settings_Section_PaletteInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`팔레트`)
};

/**
* | output |
* | --- |
* | "Palette" |
*
* @param {Settings_Section_PaletteInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const settings_section_palette = /** @type {((inputs?: Settings_Section_PaletteInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Settings_Section_PaletteInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_settings_section_palette(inputs)
	return ko_settings_section_palette(inputs)
});