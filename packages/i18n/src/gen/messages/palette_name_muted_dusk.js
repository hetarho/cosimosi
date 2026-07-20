/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Palette_Name_Muted_DuskInputs */

const en_palette_name_muted_dusk = /** @type {(inputs: Palette_Name_Muted_DuskInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Muted dusk`)
};

const ko_palette_name_muted_dusk = /** @type {(inputs: Palette_Name_Muted_DuskInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`어스름`)
};

/**
* | output |
* | --- |
* | "Muted dusk" |
*
* @param {Palette_Name_Muted_DuskInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const palette_name_muted_dusk = /** @type {((inputs?: Palette_Name_Muted_DuskInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Palette_Name_Muted_DuskInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_palette_name_muted_dusk(inputs)
	return ko_palette_name_muted_dusk(inputs)
});