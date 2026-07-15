/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Diary_Reader_All_Let_GoInputs */

const en_diary_reader_all_let_go = /** @type {(inputs: Diary_Reader_All_Let_GoInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Every star from this diary has been let go.`)
};

const ko_diary_reader_all_let_go = /** @type {(inputs: Diary_Reader_All_Let_GoInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`이 일기의 별은 모두 놓아주었어요.`)
};

/**
* | output |
* | --- |
* | "Every star from this diary has been let go." |
*
* @param {Diary_Reader_All_Let_GoInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const diary_reader_all_let_go = /** @type {((inputs?: Diary_Reader_All_Let_GoInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Diary_Reader_All_Let_GoInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_diary_reader_all_let_go(inputs)
	return ko_diary_reader_all_let_go(inputs)
});