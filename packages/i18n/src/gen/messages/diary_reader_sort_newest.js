/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Diary_Reader_Sort_NewestInputs */

const en_diary_reader_sort_newest = /** @type {(inputs: Diary_Reader_Sort_NewestInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Newest first`)
};

const ko_diary_reader_sort_newest = /** @type {(inputs: Diary_Reader_Sort_NewestInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`최신순`)
};

/**
* | output |
* | --- |
* | "Newest first" |
*
* @param {Diary_Reader_Sort_NewestInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const diary_reader_sort_newest = /** @type {((inputs?: Diary_Reader_Sort_NewestInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Diary_Reader_Sort_NewestInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_diary_reader_sort_newest(inputs)
	return ko_diary_reader_sort_newest(inputs)
});