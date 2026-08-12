/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Palette_Preset_AuthoredInputs */

const en_palette_preset_authored = /** @type {(inputs: Palette_Preset_AuthoredInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`This feeling's own color`)
};

const ko_palette_preset_authored = /** @type {(inputs: Palette_Preset_AuthoredInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`이 감정의 기본색`)
};

/**
* | output |
* | --- |
* | "This feeling's own color" |
*
* @param {Palette_Preset_AuthoredInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const palette_preset_authored = /** @type {((inputs?: Palette_Preset_AuthoredInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Palette_Preset_AuthoredInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_palette_preset_authored(inputs)
	return ko_palette_preset_authored(inputs)
});