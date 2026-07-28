/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Diary_Search_To_LabelInputs */

const en_diary_search_to_label = /** @type {(inputs: Diary_Search_To_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`To`)
};

const ko_diary_search_to_label = /** @type {(inputs: Diary_Search_To_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`끝 날짜`)
};

/**
* | output |
* | --- |
* | "To" |
*
* @param {Diary_Search_To_LabelInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const diary_search_to_label = /** @type {((inputs?: Diary_Search_To_LabelInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Diary_Search_To_LabelInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_diary_search_to_label(inputs)
	return ko_diary_search_to_label(inputs)
});