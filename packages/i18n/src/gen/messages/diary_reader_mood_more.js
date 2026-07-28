/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ count: NonNullable<unknown> }} Diary_Reader_Mood_MoreInputs */

const en_diary_reader_mood_more = /** @type {(inputs: Diary_Reader_Mood_MoreInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`+${i?.count}`)
};

const ko_diary_reader_mood_more = /** @type {(inputs: Diary_Reader_Mood_MoreInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`+${i?.count}`)
};

/**
* | output |
* | --- |
* | "+{count}" |
*
* @param {Diary_Reader_Mood_MoreInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const diary_reader_mood_more = /** @type {((inputs: Diary_Reader_Mood_MoreInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Diary_Reader_Mood_MoreInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_diary_reader_mood_more(inputs)
	return ko_diary_reader_mood_more(inputs)
});