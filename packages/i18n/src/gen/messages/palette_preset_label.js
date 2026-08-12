/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Palette_Preset_LabelInputs */

const en_palette_preset_label = /** @type {(inputs: Palette_Preset_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Choose this color`)
};

const ko_palette_preset_label = /** @type {(inputs: Palette_Preset_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`이 색을 고르기`)
};

/**
* | output |
* | --- |
* | "Choose this color" |
*
* @param {Palette_Preset_LabelInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const palette_preset_label = /** @type {((inputs?: Palette_Preset_LabelInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Palette_Preset_LabelInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_palette_preset_label(inputs)
	return ko_palette_preset_label(inputs)
});