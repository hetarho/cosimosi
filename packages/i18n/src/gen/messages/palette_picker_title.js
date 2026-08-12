/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Palette_Picker_TitleInputs */

const en_palette_picker_title = /** @type {(inputs: Palette_Picker_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Pick your own`)
};

const ko_palette_picker_title = /** @type {(inputs: Palette_Picker_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`직접 고르기`)
};

/**
* | output |
* | --- |
* | "Pick your own" |
*
* @param {Palette_Picker_TitleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const palette_picker_title = /** @type {((inputs?: Palette_Picker_TitleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Palette_Picker_TitleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_palette_picker_title(inputs)
	return ko_palette_picker_title(inputs)
});