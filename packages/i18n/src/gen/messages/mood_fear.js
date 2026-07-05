/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Mood_FearInputs */

const en_mood_fear = /** @type {(inputs: Mood_FearInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Fear`)
};

const ko_mood_fear = /** @type {(inputs: Mood_FearInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`두려움`)
};

/**
* | output |
* | --- |
* | "Fear" |
*
* @param {Mood_FearInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const mood_fear = /** @type {((inputs?: Mood_FearInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Mood_FearInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_mood_fear(inputs)
	return ko_mood_fear(inputs)
});