/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Diary_Reader_EmptyInputs */

const en_diary_reader_empty = /** @type {(inputs: Diary_Reader_EmptyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`No diaries kept yet.`)
};

const ko_diary_reader_empty = /** @type {(inputs: Diary_Reader_EmptyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`아직 담아 둔 일기가 없어요.`)
};

/**
* | output |
* | --- |
* | "No diaries kept yet." |
*
* @param {Diary_Reader_EmptyInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const diary_reader_empty = /** @type {((inputs?: Diary_Reader_EmptyInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Diary_Reader_EmptyInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_diary_reader_empty(inputs)
	return ko_diary_reader_empty(inputs)
});