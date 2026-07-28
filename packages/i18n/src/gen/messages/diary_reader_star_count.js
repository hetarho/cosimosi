/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ count: NonNullable<unknown> }} Diary_Reader_Star_CountInputs */

const en_diary_reader_star_count = /** @type {(inputs: Diary_Reader_Star_CountInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`Stars: ${i?.count}`)
};

const ko_diary_reader_star_count = /** @type {(inputs: Diary_Reader_Star_CountInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`별 ${i?.count}개`)
};

/**
* | output |
* | --- |
* | "Stars: {count}" |
*
* @param {Diary_Reader_Star_CountInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const diary_reader_star_count = /** @type {((inputs: Diary_Reader_Star_CountInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Diary_Reader_Star_CountInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_diary_reader_star_count(inputs)
	return ko_diary_reader_star_count(inputs)
});