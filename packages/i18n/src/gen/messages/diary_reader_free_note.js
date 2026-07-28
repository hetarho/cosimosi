/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Diary_Reader_Free_NoteInputs */

const en_diary_reader_free_note = /** @type {(inputs: Diary_Reader_Free_NoteInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Reading and searching cost nothing, and the universe's time stands still here.`)
};

const ko_diary_reader_free_note = /** @type {(inputs: Diary_Reader_Free_NoteInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`읽고 찾는 일에는 값이 들지 않아요. 여기서는 우주의 시간도 멈춰 있습니다.`)
};

/**
* | output |
* | --- |
* | "Reading and searching cost nothing, and the universe's time stands still here." |
*
* @param {Diary_Reader_Free_NoteInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const diary_reader_free_note = /** @type {((inputs?: Diary_Reader_Free_NoteInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Diary_Reader_Free_NoteInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_diary_reader_free_note(inputs)
	return ko_diary_reader_free_note(inputs)
});