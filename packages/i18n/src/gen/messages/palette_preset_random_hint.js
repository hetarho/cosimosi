/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Palette_Preset_Random_HintInputs */

const en_palette_preset_random_hint = /** @type {(inputs: Palette_Preset_Random_HintInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Feel like trying something new?`)
};

const ko_palette_preset_random_hint = /** @type {(inputs: Palette_Preset_Random_HintInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`새로운 도전을 해보고 싶다면?`)
};

/**
* | output |
* | --- |
* | "Feel like trying something new?" |
*
* @param {Palette_Preset_Random_HintInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const palette_preset_random_hint = /** @type {((inputs?: Palette_Preset_Random_HintInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Palette_Preset_Random_HintInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_palette_preset_random_hint(inputs)
	return ko_palette_preset_random_hint(inputs)
});