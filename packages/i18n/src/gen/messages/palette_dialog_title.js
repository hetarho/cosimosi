/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ mood: NonNullable<unknown> }} Palette_Dialog_TitleInputs */

const en_palette_dialog_title = /** @type {(inputs: Palette_Dialog_TitleInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`The color for ${i?.mood}`)
};

const ko_palette_dialog_title = /** @type {(inputs: Palette_Dialog_TitleInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.mood}의 색`)
};

/**
* | output |
* | --- |
* | "The color for {mood}" |
*
* @param {Palette_Dialog_TitleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const palette_dialog_title = /** @type {((inputs: Palette_Dialog_TitleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Palette_Dialog_TitleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_palette_dialog_title(inputs)
	return ko_palette_dialog_title(inputs)
});