/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Landing_Play_Mood_LabelInputs */

const en_landing_play_mood_label = /** @type {(inputs: Landing_Play_Mood_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`How it felt`)
};

const ko_landing_play_mood_label = /** @type {(inputs: Landing_Play_Mood_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`그때의 기분`)
};

/**
* | output |
* | --- |
* | "How it felt" |
*
* @param {Landing_Play_Mood_LabelInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const landing_play_mood_label = /** @type {((inputs?: Landing_Play_Mood_LabelInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Landing_Play_Mood_LabelInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_landing_play_mood_label(inputs)
	return ko_landing_play_mood_label(inputs)
});