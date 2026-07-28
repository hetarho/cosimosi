/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Diary_Search_Keyword_LabelInputs */

const en_diary_search_keyword_label = /** @type {(inputs: Diary_Search_Keyword_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Search the text`)
};

const ko_diary_search_keyword_label = /** @type {(inputs: Diary_Search_Keyword_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`본문 검색`)
};

/**
* | output |
* | --- |
* | "Search the text" |
*
* @param {Diary_Search_Keyword_LabelInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const diary_search_keyword_label = /** @type {((inputs?: Diary_Search_Keyword_LabelInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Diary_Search_Keyword_LabelInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_diary_search_keyword_label(inputs)
	return ko_diary_search_keyword_label(inputs)
});