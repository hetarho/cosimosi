/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Mood_AngerInputs */

const en_mood_anger = /** @type {(inputs: Mood_AngerInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Anger`)
};

const ko_mood_anger = /** @type {(inputs: Mood_AngerInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`분노`)
};

/**
* | output |
* | --- |
* | "Anger" |
*
* @param {Mood_AngerInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const mood_anger = /** @type {((inputs?: Mood_AngerInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Mood_AngerInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_mood_anger(inputs)
	return ko_mood_anger(inputs)
});