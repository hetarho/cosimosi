/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Diary_Search_Range_InvalidInputs */

const en_diary_search_range_invalid = /** @type {(inputs: Diary_Search_Range_InvalidInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Write dates as YYYY-MM-DD, with the start on or before the end.`)
};

const ko_diary_search_range_invalid = /** @type {(inputs: Diary_Search_Range_InvalidInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`날짜를 YYYY-MM-DD로, 시작일이 끝 날짜보다 앞서도록 적어 주세요.`)
};

/**
* | output |
* | --- |
* | "Write dates as YYYY-MM-DD, with the start on or before the end." |
*
* @param {Diary_Search_Range_InvalidInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const diary_search_range_invalid = /** @type {((inputs?: Diary_Search_Range_InvalidInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Diary_Search_Range_InvalidInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_diary_search_range_invalid(inputs)
	return ko_diary_search_range_invalid(inputs)
});