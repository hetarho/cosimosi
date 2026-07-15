/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Diary_Reader_Load_MoreInputs */

const en_diary_reader_load_more = /** @type {(inputs: Diary_Reader_Load_MoreInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Show earlier entries`)
};

const ko_diary_reader_load_more = /** @type {(inputs: Diary_Reader_Load_MoreInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`지난 일기 더 보기`)
};

/**
* | output |
* | --- |
* | "Show earlier entries" |
*
* @param {Diary_Reader_Load_MoreInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const diary_reader_load_more = /** @type {((inputs?: Diary_Reader_Load_MoreInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Diary_Reader_Load_MoreInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_diary_reader_load_more(inputs)
	return ko_diary_reader_load_more(inputs)
});