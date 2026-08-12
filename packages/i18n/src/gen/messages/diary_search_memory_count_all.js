/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Diary_Search_Memory_Count_AllInputs */

const en_diary_search_memory_count_all = /** @type {(inputs: Diary_Search_Memory_Count_AllInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Any star count`)
};

const ko_diary_search_memory_count_all = /** @type {(inputs: Diary_Search_Memory_Count_AllInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`별 갯수 전체`)
};

/**
* | output |
* | --- |
* | "Any star count" |
*
* @param {Diary_Search_Memory_Count_AllInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const diary_search_memory_count_all = /** @type {((inputs?: Diary_Search_Memory_Count_AllInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Diary_Search_Memory_Count_AllInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_diary_search_memory_count_all(inputs)
	return ko_diary_search_memory_count_all(inputs)
});