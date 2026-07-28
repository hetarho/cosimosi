/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Palette_Editor_TitleInputs */

const en_palette_editor_title = /** @type {(inputs: Palette_Editor_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Colors your feelings answer to`)
};

const ko_palette_editor_title = /** @type {(inputs: Palette_Editor_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`감정마다 불러 줄 색`)
};

/**
* | output |
* | --- |
* | "Colors your feelings answer to" |
*
* @param {Palette_Editor_TitleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const palette_editor_title = /** @type {((inputs?: Palette_Editor_TitleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Palette_Editor_TitleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_palette_editor_title(inputs)
	return ko_palette_editor_title(inputs)
});