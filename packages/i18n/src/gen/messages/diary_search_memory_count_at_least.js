/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ count: NonNullable<unknown> }} Diary_Search_Memory_Count_At_LeastInputs */

const en_diary_search_memory_count_at_least = /** @type {(inputs: Diary_Search_Memory_Count_At_LeastInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.count}+ stars`)
};

const ko_diary_search_memory_count_at_least = /** @type {(inputs: Diary_Search_Memory_Count_At_LeastInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`별 ${i?.count}개 이상`)
};

/**
* | output |
* | --- |
* | "{count}+ stars" |
*
* @param {Diary_Search_Memory_Count_At_LeastInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const diary_search_memory_count_at_least = /** @type {((inputs: Diary_Search_Memory_Count_At_LeastInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Diary_Search_Memory_Count_At_LeastInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_diary_search_memory_count_at_least(inputs)
	return ko_diary_search_memory_count_at_least(inputs)
});