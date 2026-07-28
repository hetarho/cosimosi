/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Diary_Search_From_LabelInputs */

const en_diary_search_from_label = /** @type {(inputs: Diary_Search_From_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`From`)
};

const ko_diary_search_from_label = /** @type {(inputs: Diary_Search_From_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`시작 날짜`)
};

/**
* | output |
* | --- |
* | "From" |
*
* @param {Diary_Search_From_LabelInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const diary_search_from_label = /** @type {((inputs?: Diary_Search_From_LabelInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Diary_Search_From_LabelInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_diary_search_from_label(inputs)
	return ko_diary_search_from_label(inputs)
});