/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Diary_Search_Memory_Count_NoneInputs */

const en_diary_search_memory_count_none = /** @type {(inputs: Diary_Search_Memory_Count_NoneInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`No stars`)
};

const ko_diary_search_memory_count_none = /** @type {(inputs: Diary_Search_Memory_Count_NoneInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`별 없음`)
};

/**
* | output |
* | --- |
* | "No stars" |
*
* @param {Diary_Search_Memory_Count_NoneInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const diary_search_memory_count_none = /** @type {((inputs?: Diary_Search_Memory_Count_NoneInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Diary_Search_Memory_Count_NoneInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_diary_search_memory_count_none(inputs)
	return ko_diary_search_memory_count_none(inputs)
});