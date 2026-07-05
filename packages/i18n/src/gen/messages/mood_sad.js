/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Mood_SadInputs */

const en_mood_sad = /** @type {(inputs: Mood_SadInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Sadness`)
};

const ko_mood_sad = /** @type {(inputs: Mood_SadInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`슬픔`)
};

/**
* | output |
* | --- |
* | "Sadness" |
*
* @param {Mood_SadInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const mood_sad = /** @type {((inputs?: Mood_SadInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Mood_SadInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_mood_sad(inputs)
	return ko_mood_sad(inputs)
});