/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Mood_NeutralInputs */

const en_mood_neutral = /** @type {(inputs: Mood_NeutralInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Neutral`)
};

const ko_mood_neutral = /** @type {(inputs: Mood_NeutralInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`무감정`)
};

/**
* | output |
* | --- |
* | "Neutral" |
*
* @param {Mood_NeutralInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const mood_neutral = /** @type {((inputs?: Mood_NeutralInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Mood_NeutralInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_mood_neutral(inputs)
	return ko_mood_neutral(inputs)
});