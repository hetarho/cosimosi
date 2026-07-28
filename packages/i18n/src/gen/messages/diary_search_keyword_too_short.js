/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ count: NonNullable<unknown> }} Diary_Search_Keyword_Too_ShortInputs */

const en_diary_search_keyword_too_short = /** @type {(inputs: Diary_Search_Keyword_Too_ShortInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`Type at least ${i?.count} characters.`)
};

const ko_diary_search_keyword_too_short = /** @type {(inputs: Diary_Search_Keyword_Too_ShortInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.count}자 이상 적어 주세요.`)
};

/**
* | output |
* | --- |
* | "Type at least {count} characters." |
*
* @param {Diary_Search_Keyword_Too_ShortInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const diary_search_keyword_too_short = /** @type {((inputs: Diary_Search_Keyword_Too_ShortInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Diary_Search_Keyword_Too_ShortInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_diary_search_keyword_too_short(inputs)
	return ko_diary_search_keyword_too_short(inputs)
});