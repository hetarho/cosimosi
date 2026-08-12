/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Diary_Reader_Sort_To_OldestInputs */

const en_diary_reader_sort_to_oldest = /** @type {(inputs: Diary_Reader_Sort_To_OldestInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Show oldest first`)
};

const ko_diary_reader_sort_to_oldest = /** @type {(inputs: Diary_Reader_Sort_To_OldestInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`오래된 순으로 보기`)
};

/**
* | output |
* | --- |
* | "Show oldest first" |
*
* @param {Diary_Reader_Sort_To_OldestInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const diary_reader_sort_to_oldest = /** @type {((inputs?: Diary_Reader_Sort_To_OldestInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Diary_Reader_Sort_To_OldestInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_diary_reader_sort_to_oldest(inputs)
	return ko_diary_reader_sort_to_oldest(inputs)
});