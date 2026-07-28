/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Diary_Reader_Paid_HintInputs */

const en_diary_reader_paid_hint = /** @type {(inputs: Diary_Reader_Paid_HintInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`This is the only door here that spends stardust.`)
};

const ko_diary_reader_paid_hint = /** @type {(inputs: Diary_Reader_Paid_HintInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`별가루를 쓰는 문은 이 하나뿐이에요.`)
};

/**
* | output |
* | --- |
* | "This is the only door here that spends stardust." |
*
* @param {Diary_Reader_Paid_HintInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const diary_reader_paid_hint = /** @type {((inputs?: Diary_Reader_Paid_HintInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Diary_Reader_Paid_HintInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_diary_reader_paid_hint(inputs)
	return ko_diary_reader_paid_hint(inputs)
});