/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Diary_Search_Memory_Count_LabelInputs */

const en_diary_search_memory_count_label = /** @type {(inputs: Diary_Search_Memory_Count_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Stars`)
};

const ko_diary_search_memory_count_label = /** @type {(inputs: Diary_Search_Memory_Count_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`별 갯수`)
};

/**
* | output |
* | --- |
* | "Stars" |
*
* @param {Diary_Search_Memory_Count_LabelInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const diary_search_memory_count_label = /** @type {((inputs?: Diary_Search_Memory_Count_LabelInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Diary_Search_Memory_Count_LabelInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_diary_search_memory_count_label(inputs)
	return ko_diary_search_memory_count_label(inputs)
});