/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Diary_Reader_Sort_LabelInputs */

const en_diary_reader_sort_label = /** @type {(inputs: Diary_Reader_Sort_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Order`)
};

const ko_diary_reader_sort_label = /** @type {(inputs: Diary_Reader_Sort_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`정렬`)
};

/**
* | output |
* | --- |
* | "Order" |
*
* @param {Diary_Reader_Sort_LabelInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const diary_reader_sort_label = /** @type {((inputs?: Diary_Reader_Sort_LabelInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Diary_Reader_Sort_LabelInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_diary_reader_sort_label(inputs)
	return ko_diary_reader_sort_label(inputs)
});