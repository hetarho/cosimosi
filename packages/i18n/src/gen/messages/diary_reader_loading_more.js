/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Diary_Reader_Loading_MoreInputs */

const en_diary_reader_loading_more = /** @type {(inputs: Diary_Reader_Loading_MoreInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Bringing up earlier entries…`)
};

const ko_diary_reader_loading_more = /** @type {(inputs: Diary_Reader_Loading_MoreInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`지난 일기를 불러오는 중…`)
};

/**
* | output |
* | --- |
* | "Bringing up earlier entries…" |
*
* @param {Diary_Reader_Loading_MoreInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const diary_reader_loading_more = /** @type {((inputs?: Diary_Reader_Loading_MoreInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Diary_Reader_Loading_MoreInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_diary_reader_loading_more(inputs)
	return ko_diary_reader_loading_more(inputs)
});