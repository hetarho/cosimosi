/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Diary_Reader_No_ResultsInputs */

const en_diary_reader_no_results = /** @type {(inputs: Diary_Reader_No_ResultsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Nothing written matches that.`)
};

const ko_diary_reader_no_results = /** @type {(inputs: Diary_Reader_No_ResultsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`그런 기록은 찾지 못했어요.`)
};

/**
* | output |
* | --- |
* | "Nothing written matches that." |
*
* @param {Diary_Reader_No_ResultsInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const diary_reader_no_results = /** @type {((inputs?: Diary_Reader_No_ResultsInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Diary_Reader_No_ResultsInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_diary_reader_no_results(inputs)
	return ko_diary_reader_no_results(inputs)
});