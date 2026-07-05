/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Mood_ExcitementInputs */

const en_mood_excitement = /** @type {(inputs: Mood_ExcitementInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Excitement`)
};

const ko_mood_excitement = /** @type {(inputs: Mood_ExcitementInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`설렘`)
};

/**
* | output |
* | --- |
* | "Excitement" |
*
* @param {Mood_ExcitementInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const mood_excitement = /** @type {((inputs?: Mood_ExcitementInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Mood_ExcitementInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_mood_excitement(inputs)
	return ko_mood_excitement(inputs)
});