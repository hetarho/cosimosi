/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Palette_Picker_ChromaInputs */

const en_palette_picker_chroma = /** @type {(inputs: Palette_Picker_ChromaInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Vividness`)
};

const ko_palette_picker_chroma = /** @type {(inputs: Palette_Picker_ChromaInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`선명함`)
};

/**
* | output |
* | --- |
* | "Vividness" |
*
* @param {Palette_Picker_ChromaInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const palette_picker_chroma = /** @type {((inputs?: Palette_Picker_ChromaInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Palette_Picker_ChromaInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_palette_picker_chroma(inputs)
	return ko_palette_picker_chroma(inputs)
});