/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Palette_SaveInputs */

const en_palette_save = /** @type {(inputs: Palette_SaveInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Keep this color`)
};

const ko_palette_save = /** @type {(inputs: Palette_SaveInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`이 색으로 두기`)
};

/**
* | output |
* | --- |
* | "Keep this color" |
*
* @param {Palette_SaveInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const palette_save = /** @type {((inputs?: Palette_SaveInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Palette_SaveInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_palette_save(inputs)
	return ko_palette_save(inputs)
});