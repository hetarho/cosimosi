/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Mood_StressInputs */

const en_mood_stress = /** @type {(inputs: Mood_StressInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Stress`)
};

const ko_mood_stress = /** @type {(inputs: Mood_StressInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`스트레스`)
};

/**
* | output |
* | --- |
* | "Stress" |
*
* @param {Mood_StressInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const mood_stress = /** @type {((inputs?: Mood_StressInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Mood_StressInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_mood_stress(inputs)
	return ko_mood_stress(inputs)
});