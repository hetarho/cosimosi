/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Mood_CalmInputs */

const en_mood_calm = /** @type {(inputs: Mood_CalmInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Calm`)
};

const ko_mood_calm = /** @type {(inputs: Mood_CalmInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`평온`)
};

/**
* | output |
* | --- |
* | "Calm" |
*
* @param {Mood_CalmInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const mood_calm = /** @type {((inputs?: Mood_CalmInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Mood_CalmInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_mood_calm(inputs)
	return ko_mood_calm(inputs)
});