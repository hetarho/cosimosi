/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Landing_Hero_Image_AltInputs */

const en_landing_hero_image_alt = /** @type {(inputs: Landing_Hero_Image_AltInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`An empty night sky, faintly lit, before anything has been written.`)
};

const ko_landing_hero_image_alt = /** @type {(inputs: Landing_Hero_Image_AltInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`아무것도 쓰이지 않은, 희미하게 밝은 밤하늘.`)
};

/**
* | output |
* | --- |
* | "An empty night sky, faintly lit, before anything has been written." |
*
* @param {Landing_Hero_Image_AltInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const landing_hero_image_alt = /** @type {((inputs?: Landing_Hero_Image_AltInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Landing_Hero_Image_AltInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_landing_hero_image_alt(inputs)
	return ko_landing_hero_image_alt(inputs)
});