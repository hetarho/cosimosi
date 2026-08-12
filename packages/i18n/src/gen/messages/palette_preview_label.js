/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Palette_Preview_LabelInputs */

const en_palette_preview_label = /** @type {(inputs: Palette_Preview_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Your choice`)
};

const ko_palette_preview_label = /** @type {(inputs: Palette_Preview_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`고른 색`)
};

/**
* | output |
* | --- |
* | "Your choice" |
*
* @param {Palette_Preview_LabelInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const palette_preview_label = /** @type {((inputs?: Palette_Preview_LabelInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Palette_Preview_LabelInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_palette_preview_label(inputs)
	return ko_palette_preview_label(inputs)
});