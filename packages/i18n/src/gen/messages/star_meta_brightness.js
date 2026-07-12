/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Star_Meta_BrightnessInputs */

const en_star_meta_brightness = /** @type {(inputs: Star_Meta_BrightnessInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Brightness`)
};

const ko_star_meta_brightness = /** @type {(inputs: Star_Meta_BrightnessInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`밝기`)
};

/**
* | output |
* | --- |
* | "Brightness" |
*
* @param {Star_Meta_BrightnessInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const star_meta_brightness = /** @type {((inputs?: Star_Meta_BrightnessInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Star_Meta_BrightnessInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_star_meta_brightness(inputs)
	return ko_star_meta_brightness(inputs)
});