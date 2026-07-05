/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Mood_EmptinessInputs */

const en_mood_emptiness = /** @type {(inputs: Mood_EmptinessInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Emptiness`)
};

const ko_mood_emptiness = /** @type {(inputs: Mood_EmptinessInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`공허`)
};

/**
* | output |
* | --- |
* | "Emptiness" |
*
* @param {Mood_EmptinessInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const mood_emptiness = /** @type {((inputs?: Mood_EmptinessInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Mood_EmptinessInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_mood_emptiness(inputs)
	return ko_mood_emptiness(inputs)
});