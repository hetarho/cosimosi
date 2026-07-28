/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Diary_Search_Mood_LabelInputs */

const en_diary_search_mood_label = /** @type {(inputs: Diary_Search_Mood_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Feeling`)
};

const ko_diary_search_mood_label = /** @type {(inputs: Diary_Search_Mood_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`감정`)
};

/**
* | output |
* | --- |
* | "Feeling" |
*
* @param {Diary_Search_Mood_LabelInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const diary_search_mood_label = /** @type {((inputs?: Diary_Search_Mood_LabelInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Diary_Search_Mood_LabelInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_diary_search_mood_label(inputs)
	return ko_diary_search_mood_label(inputs)
});