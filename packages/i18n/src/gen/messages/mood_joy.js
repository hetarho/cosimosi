/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Mood_JoyInputs */

const en_mood_joy = /** @type {(inputs: Mood_JoyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Joy`)
};

const ko_mood_joy = /** @type {(inputs: Mood_JoyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`기쁨`)
};

/**
* | output |
* | --- |
* | "Joy" |
*
* @param {Mood_JoyInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const mood_joy = /** @type {((inputs?: Mood_JoyInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Mood_JoyInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_mood_joy(inputs)
	return ko_mood_joy(inputs)
});