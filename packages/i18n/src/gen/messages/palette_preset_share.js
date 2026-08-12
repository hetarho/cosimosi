/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ percent: NonNullable<unknown> }} Palette_Preset_ShareInputs */

const en_palette_preset_share = /** @type {(inputs: Palette_Preset_ShareInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.percent}% of choices so far are a color like this`)
};

const ko_palette_preset_share = /** @type {(inputs: Palette_Preset_ShareInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`지금까지 ${i?.percent}%가 비슷한 색을 골랐어요`)
};

/**
* | output |
* | --- |
* | "{percent}% of choices so far are a color like this" |
*
* @param {Palette_Preset_ShareInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const palette_preset_share = /** @type {((inputs: Palette_Preset_ShareInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Palette_Preset_ShareInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_palette_preset_share(inputs)
	return ko_palette_preset_share(inputs)
});