/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Mood_TiredInputs */

const en_mood_tired = /** @type {(inputs: Mood_TiredInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Tiredness`)
};

const ko_mood_tired = /** @type {(inputs: Mood_TiredInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`피로`)
};

/**
* | output |
* | --- |
* | "Tiredness" |
*
* @param {Mood_TiredInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const mood_tired = /** @type {((inputs?: Mood_TiredInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Mood_TiredInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_mood_tired(inputs)
	return ko_mood_tired(inputs)
});