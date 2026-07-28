/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ moods: NonNullable<unknown> }} Diary_Reader_Mood_ListInputs */

const en_diary_reader_mood_list = /** @type {(inputs: Diary_Reader_Mood_ListInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`Feelings in this diary: ${i?.moods}`)
};

const ko_diary_reader_mood_list = /** @type {(inputs: Diary_Reader_Mood_ListInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`이 일기의 감정: ${i?.moods}`)
};

/**
* | output |
* | --- |
* | "Feelings in this diary: {moods}" |
*
* @param {Diary_Reader_Mood_ListInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const diary_reader_mood_list = /** @type {((inputs: Diary_Reader_Mood_ListInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Diary_Reader_Mood_ListInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_diary_reader_mood_list(inputs)
	return ko_diary_reader_mood_list(inputs)
});