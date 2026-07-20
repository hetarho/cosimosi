/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Settings_Palette_SelectedInputs */

const en_settings_palette_selected = /** @type {(inputs: Settings_Palette_SelectedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`In use`)
};

const ko_settings_palette_selected = /** @type {(inputs: Settings_Palette_SelectedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`지금 쓰는 팔레트`)
};

/**
* | output |
* | --- |
* | "In use" |
*
* @param {Settings_Palette_SelectedInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const settings_palette_selected = /** @type {((inputs?: Settings_Palette_SelectedInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Settings_Palette_SelectedInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_settings_palette_selected(inputs)
	return ko_settings_palette_selected(inputs)
});