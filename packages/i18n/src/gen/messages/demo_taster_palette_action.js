/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Demo_Taster_Palette_ActionInputs */

const en_demo_taster_palette_action = /** @type {(inputs: Demo_Taster_Palette_ActionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`The colour a feeling gets`)
};

const ko_demo_taster_palette_action = /** @type {(inputs: Demo_Taster_Palette_ActionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`감정의 색`)
};

/**
* | output |
* | --- |
* | "The colour a feeling gets" |
*
* @param {Demo_Taster_Palette_ActionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const demo_taster_palette_action = /** @type {((inputs?: Demo_Taster_Palette_ActionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Demo_Taster_Palette_ActionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_demo_taster_palette_action(inputs)
	return ko_demo_taster_palette_action(inputs)
});