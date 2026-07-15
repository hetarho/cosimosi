/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Diary_Reader_LoadingInputs */

const en_diary_reader_loading = /** @type {(inputs: Diary_Reader_LoadingInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Opening the diary…`)
};

const ko_diary_reader_loading = /** @type {(inputs: Diary_Reader_LoadingInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`일기장을 펼치는 중…`)
};

/**
* | output |
* | --- |
* | "Opening the diary…" |
*
* @param {Diary_Reader_LoadingInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const diary_reader_loading = /** @type {((inputs?: Diary_Reader_LoadingInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Diary_Reader_LoadingInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_diary_reader_loading(inputs)
	return ko_diary_reader_loading(inputs)
});