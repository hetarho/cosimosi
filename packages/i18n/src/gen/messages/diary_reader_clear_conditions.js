/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Diary_Reader_Clear_ConditionsInputs */

const en_diary_reader_clear_conditions = /** @type {(inputs: Diary_Reader_Clear_ConditionsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Clear conditions`)
};

const ko_diary_reader_clear_conditions = /** @type {(inputs: Diary_Reader_Clear_ConditionsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`조건 지우기`)
};

/**
* | output |
* | --- |
* | "Clear conditions" |
*
* @param {Diary_Reader_Clear_ConditionsInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const diary_reader_clear_conditions = /** @type {((inputs?: Diary_Reader_Clear_ConditionsInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Diary_Reader_Clear_ConditionsInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_diary_reader_clear_conditions(inputs)
	return ko_diary_reader_clear_conditions(inputs)
});