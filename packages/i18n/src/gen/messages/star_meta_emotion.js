/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Star_Meta_EmotionInputs */

const en_star_meta_emotion = /** @type {(inputs: Star_Meta_EmotionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Emotion`)
};

const ko_star_meta_emotion = /** @type {(inputs: Star_Meta_EmotionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`감정`)
};

/**
* | output |
* | --- |
* | "Emotion" |
*
* @param {Star_Meta_EmotionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const star_meta_emotion = /** @type {((inputs?: Star_Meta_EmotionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Star_Meta_EmotionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_star_meta_emotion(inputs)
	return ko_star_meta_emotion(inputs)
});