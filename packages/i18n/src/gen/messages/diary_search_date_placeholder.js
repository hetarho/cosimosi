/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Diary_Search_Date_PlaceholderInputs */

const en_diary_search_date_placeholder = /** @type {(inputs: Diary_Search_Date_PlaceholderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`2026-01-31`)
};

const ko_diary_search_date_placeholder = /** @type {(inputs: Diary_Search_Date_PlaceholderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`2026-01-31`)
};

/**
* | output |
* | --- |
* | "2026-01-31" |
*
* @param {Diary_Search_Date_PlaceholderInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const diary_search_date_placeholder = /** @type {((inputs?: Diary_Search_Date_PlaceholderInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Diary_Search_Date_PlaceholderInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_diary_search_date_placeholder(inputs)
	return ko_diary_search_date_placeholder(inputs)
});