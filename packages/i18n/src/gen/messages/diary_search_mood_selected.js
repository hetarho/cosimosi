/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ count: NonNullable<unknown> }} Diary_Search_Mood_SelectedInputs */

const en_diary_search_mood_selected = /** @type {(inputs: Diary_Search_Mood_SelectedInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.count} selected`)
};

const ko_diary_search_mood_selected = /** @type {(inputs: Diary_Search_Mood_SelectedInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.count}개 골랐어요`)
};

/**
* | output |
* | --- |
* | "{count} selected" |
*
* @param {Diary_Search_Mood_SelectedInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const diary_search_mood_selected = /** @type {((inputs: Diary_Search_Mood_SelectedInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Diary_Search_Mood_SelectedInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_diary_search_mood_selected(inputs)
	return ko_diary_search_mood_selected(inputs)
});