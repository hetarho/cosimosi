/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ rank: NonNullable<unknown> }} Palette_Preset_Popular_RankInputs */

const en_palette_preset_popular_rank = /** @type {(inputs: Palette_Preset_Popular_RankInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`#${i?.rank} most chosen`)
};

const ko_palette_preset_popular_rank = /** @type {(inputs: Palette_Preset_Popular_RankInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.rank}번째로 많이 고른 색`)
};

/**
* | output |
* | --- |
* | "#{rank} most chosen" |
*
* @param {Palette_Preset_Popular_RankInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const palette_preset_popular_rank = /** @type {((inputs: Palette_Preset_Popular_RankInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Palette_Preset_Popular_RankInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_palette_preset_popular_rank(inputs)
	return ko_palette_preset_popular_rank(inputs)
});