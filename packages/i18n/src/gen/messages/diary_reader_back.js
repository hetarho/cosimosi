/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Diary_Reader_BackInputs */

const en_diary_reader_back = /** @type {(inputs: Diary_Reader_BackInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Back to the universe`)
};

const ko_diary_reader_back = /** @type {(inputs: Diary_Reader_BackInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`우주로 돌아가기`)
};

/**
* | output |
* | --- |
* | "Back to the universe" |
*
* @param {Diary_Reader_BackInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const diary_reader_back = /** @type {((inputs?: Diary_Reader_BackInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Diary_Reader_BackInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_diary_reader_back(inputs)
	return ko_diary_reader_back(inputs)
});