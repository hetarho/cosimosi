/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Mood_ReliefInputs */

const en_mood_relief = /** @type {(inputs: Mood_ReliefInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Relief`)
};

const ko_mood_relief = /** @type {(inputs: Mood_ReliefInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`안도`)
};

/**
* | output |
* | --- |
* | "Relief" |
*
* @param {Mood_ReliefInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const mood_relief = /** @type {((inputs?: Mood_ReliefInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Mood_ReliefInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_mood_relief(inputs)
	return ko_mood_relief(inputs)
});