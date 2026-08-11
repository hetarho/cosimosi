/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Diary_Reader_Open_Entry_HintInputs */

const en_diary_reader_open_entry_hint = /** @type {(inputs: Diary_Reader_Open_Entry_HintInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Open this diary`)
};

const ko_diary_reader_open_entry_hint = /** @type {(inputs: Diary_Reader_Open_Entry_HintInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`눌러서 일기 펼치기`)
};

/**
* | output |
* | --- |
* | "Open this diary" |
*
* @param {Diary_Reader_Open_Entry_HintInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const diary_reader_open_entry_hint = /** @type {((inputs?: Diary_Reader_Open_Entry_HintInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Diary_Reader_Open_Entry_HintInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_diary_reader_open_entry_hint(inputs)
	return ko_diary_reader_open_entry_hint(inputs)
});