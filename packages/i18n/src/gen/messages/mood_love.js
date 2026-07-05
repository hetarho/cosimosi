/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Mood_LoveInputs */

const en_mood_love = /** @type {(inputs: Mood_LoveInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Love`)
};

const ko_mood_love = /** @type {(inputs: Mood_LoveInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`사랑`)
};

/**
* | output |
* | --- |
* | "Love" |
*
* @param {Mood_LoveInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const mood_love = /** @type {((inputs?: Mood_LoveInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Mood_LoveInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_mood_love(inputs)
	return ko_mood_love(inputs)
});