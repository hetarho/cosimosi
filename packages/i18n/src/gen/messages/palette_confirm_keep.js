/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Palette_Confirm_KeepInputs */

const en_palette_confirm_keep = /** @type {(inputs: Palette_Confirm_KeepInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Keep it anyway`)
};

const ko_palette_confirm_keep = /** @type {(inputs: Palette_Confirm_KeepInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`그래도 둘게요`)
};

/**
* | output |
* | --- |
* | "Keep it anyway" |
*
* @param {Palette_Confirm_KeepInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const palette_confirm_keep = /** @type {((inputs?: Palette_Confirm_KeepInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Palette_Confirm_KeepInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_palette_confirm_keep(inputs)
	return ko_palette_confirm_keep(inputs)
});