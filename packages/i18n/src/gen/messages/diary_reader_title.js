/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Diary_Reader_TitleInputs */

const en_diary_reader_title = /** @type {(inputs: Diary_Reader_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Diary`)
};

const ko_diary_reader_title = /** @type {(inputs: Diary_Reader_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`일기장`)
};

/**
* | output |
* | --- |
* | "Diary" |
*
* @param {Diary_Reader_TitleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const diary_reader_title = /** @type {((inputs?: Diary_Reader_TitleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Diary_Reader_TitleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_diary_reader_title(inputs)
	return ko_diary_reader_title(inputs)
});