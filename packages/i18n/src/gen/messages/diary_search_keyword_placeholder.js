/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Diary_Search_Keyword_PlaceholderInputs */

const en_diary_search_keyword_placeholder = /** @type {(inputs: Diary_Search_Keyword_PlaceholderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Find a word you wrote`)
};

const ko_diary_search_keyword_placeholder = /** @type {(inputs: Diary_Search_Keyword_PlaceholderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`적어 둔 말로 찾기`)
};

/**
* | output |
* | --- |
* | "Find a word you wrote" |
*
* @param {Diary_Search_Keyword_PlaceholderInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const diary_search_keyword_placeholder = /** @type {((inputs?: Diary_Search_Keyword_PlaceholderInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Diary_Search_Keyword_PlaceholderInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_diary_search_keyword_placeholder(inputs)
	return ko_diary_search_keyword_placeholder(inputs)
});