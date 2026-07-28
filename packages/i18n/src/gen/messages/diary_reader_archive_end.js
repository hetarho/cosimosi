/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Diary_Reader_Archive_EndInputs */

const en_diary_reader_archive_end = /** @type {(inputs: Diary_Reader_Archive_EndInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`This is where the record ends.`)
};

const ko_diary_reader_archive_end = /** @type {(inputs: Diary_Reader_Archive_EndInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`여기가 기록의 끝이에요.`)
};

/**
* | output |
* | --- |
* | "This is where the record ends." |
*
* @param {Diary_Reader_Archive_EndInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const diary_reader_archive_end = /** @type {((inputs?: Diary_Reader_Archive_EndInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Diary_Reader_Archive_EndInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_diary_reader_archive_end(inputs)
	return ko_diary_reader_archive_end(inputs)
});