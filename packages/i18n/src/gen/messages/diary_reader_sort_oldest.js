/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Diary_Reader_Sort_OldestInputs */

const en_diary_reader_sort_oldest = /** @type {(inputs: Diary_Reader_Sort_OldestInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Oldest first`)
};

const ko_diary_reader_sort_oldest = /** @type {(inputs: Diary_Reader_Sort_OldestInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`오래된순`)
};

/**
* | output |
* | --- |
* | "Oldest first" |
*
* @param {Diary_Reader_Sort_OldestInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const diary_reader_sort_oldest = /** @type {((inputs?: Diary_Reader_Sort_OldestInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Diary_Reader_Sort_OldestInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_diary_reader_sort_oldest(inputs)
	return ko_diary_reader_sort_oldest(inputs)
});