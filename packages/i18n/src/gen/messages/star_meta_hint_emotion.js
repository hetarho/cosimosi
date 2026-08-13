/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Star_Meta_Hint_EmotionInputs */

const en_star_meta_hint_emotion = /** @type {(inputs: Star_Meta_Hint_EmotionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`The emotion read from that day’s diary. The star’s colour comes from it — a different emotion is a different colour.`)
};

const ko_star_meta_hint_emotion = /** @type {(inputs: Star_Meta_Hint_EmotionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`그날 일기에서 읽은 감정이에요. 별의 색이 여기서 나와요 — 감정이 다르면 색이 달라져요.`)
};

/**
* | output |
* | --- |
* | "The emotion read from that day’s diary. The star’s colour comes from it — a different emotion is a different colour." |
*
* @param {Star_Meta_Hint_EmotionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const star_meta_hint_emotion = /** @type {((inputs?: Star_Meta_Hint_EmotionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Star_Meta_Hint_EmotionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_star_meta_hint_emotion(inputs)
	return ko_star_meta_hint_emotion(inputs)
});