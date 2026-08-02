/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Demo_Decorate_Palette_AltInputs */

const en_demo_decorate_palette_alt = /** @type {(inputs: Demo_Decorate_Palette_AltInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`A different set`)
};

const ko_demo_decorate_palette_alt = /** @type {(inputs: Demo_Decorate_Palette_AltInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`다른 색으로`)
};

/**
* | output |
* | --- |
* | "A different set" |
*
* @param {Demo_Decorate_Palette_AltInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const demo_decorate_palette_alt = /** @type {((inputs?: Demo_Decorate_Palette_AltInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Demo_Decorate_Palette_AltInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_demo_decorate_palette_alt(inputs)
	return ko_demo_decorate_palette_alt(inputs)
});