/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Mood_GratitudeInputs */

const en_mood_gratitude = /** @type {(inputs: Mood_GratitudeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Gratitude`)
};

const ko_mood_gratitude = /** @type {(inputs: Mood_GratitudeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`감사`)
};

/**
* | output |
* | --- |
* | "Gratitude" |
*
* @param {Mood_GratitudeInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const mood_gratitude = /** @type {((inputs?: Mood_GratitudeInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Mood_GratitudeInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_mood_gratitude(inputs)
	return ko_mood_gratitude(inputs)
});