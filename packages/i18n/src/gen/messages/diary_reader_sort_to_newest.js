/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Diary_Reader_Sort_To_NewestInputs */

const en_diary_reader_sort_to_newest = /** @type {(inputs: Diary_Reader_Sort_To_NewestInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Show newest first`)
};

const ko_diary_reader_sort_to_newest = /** @type {(inputs: Diary_Reader_Sort_To_NewestInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`최신 순으로 보기`)
};

/**
* | output |
* | --- |
* | "Show newest first" |
*
* @param {Diary_Reader_Sort_To_NewestInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const diary_reader_sort_to_newest = /** @type {((inputs?: Diary_Reader_Sort_To_NewestInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Diary_Reader_Sort_To_NewestInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_diary_reader_sort_to_newest(inputs)
	return ko_diary_reader_sort_to_newest(inputs)
});