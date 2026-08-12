/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Palette_Current_LabelInputs */

const en_palette_current_label = /** @type {(inputs: Palette_Current_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Its color now`)
};

const ko_palette_current_label = /** @type {(inputs: Palette_Current_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`지금의 색`)
};

/**
* | output |
* | --- |
* | "Its color now" |
*
* @param {Palette_Current_LabelInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const palette_current_label = /** @type {((inputs?: Palette_Current_LabelInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Palette_Current_LabelInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_palette_current_label(inputs)
	return ko_palette_current_label(inputs)
});