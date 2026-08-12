/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Palette_Confirm_TitleInputs */

const en_palette_confirm_title = /** @type {(inputs: Palette_Confirm_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Keep this color anyway?`)
};

const ko_palette_confirm_title = /** @type {(inputs: Palette_Confirm_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`그래도 이 색으로 둘까요?`)
};

/**
* | output |
* | --- |
* | "Keep this color anyway?" |
*
* @param {Palette_Confirm_TitleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const palette_confirm_title = /** @type {((inputs?: Palette_Confirm_TitleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Palette_Confirm_TitleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_palette_confirm_title(inputs)
	return ko_palette_confirm_title(inputs)
});