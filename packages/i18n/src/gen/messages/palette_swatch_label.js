/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ mood: NonNullable<unknown> }} Palette_Swatch_LabelInputs */

const en_palette_swatch_label = /** @type {(inputs: Palette_Swatch_LabelInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`Change the color for ${i?.mood}`)
};

const ko_palette_swatch_label = /** @type {(inputs: Palette_Swatch_LabelInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.mood}의 색 바꾸기`)
};

/**
* | output |
* | --- |
* | "Change the color for {mood}" |
*
* @param {Palette_Swatch_LabelInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const palette_swatch_label = /** @type {((inputs: Palette_Swatch_LabelInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Palette_Swatch_LabelInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_palette_swatch_label(inputs)
	return ko_palette_swatch_label(inputs)
});