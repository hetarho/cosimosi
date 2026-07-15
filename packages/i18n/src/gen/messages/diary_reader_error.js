/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Diary_Reader_ErrorInputs */

const en_diary_reader_error = /** @type {(inputs: Diary_Reader_ErrorInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`The diary wouldn't open.`)
};

const ko_diary_reader_error = /** @type {(inputs: Diary_Reader_ErrorInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`일기장을 펼치지 못했어요.`)
};

/**
* | output |
* | --- |
* | "The diary wouldn't open." |
*
* @param {Diary_Reader_ErrorInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const diary_reader_error = /** @type {((inputs?: Diary_Reader_ErrorInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Diary_Reader_ErrorInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_diary_reader_error(inputs)
	return ko_diary_reader_error(inputs)
});