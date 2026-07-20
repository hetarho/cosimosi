/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Palette_Name_Cosimosi_DefaultInputs */

const en_palette_name_cosimosi_default = /** @type {(inputs: Palette_Name_Cosimosi_DefaultInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Default`)
};

const ko_palette_name_cosimosi_default = /** @type {(inputs: Palette_Name_Cosimosi_DefaultInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`기본`)
};

/**
* | output |
* | --- |
* | "Default" |
*
* @param {Palette_Name_Cosimosi_DefaultInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const palette_name_cosimosi_default = /** @type {((inputs?: Palette_Name_Cosimosi_DefaultInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Palette_Name_Cosimosi_DefaultInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_palette_name_cosimosi_default(inputs)
	return ko_palette_name_cosimosi_default(inputs)
});