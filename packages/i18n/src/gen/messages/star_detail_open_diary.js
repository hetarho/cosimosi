/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Star_Detail_Open_DiaryInputs */

const en_star_detail_open_diary = /** @type {(inputs: Star_Detail_Open_DiaryInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Open the original diary`)
};

const ko_star_detail_open_diary = /** @type {(inputs: Star_Detail_Open_DiaryInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`원본 일기 보기`)
};

/**
* | output |
* | --- |
* | "Open the original diary" |
*
* @param {Star_Detail_Open_DiaryInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const star_detail_open_diary = /** @type {((inputs?: Star_Detail_Open_DiaryInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Star_Detail_Open_DiaryInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_star_detail_open_diary(inputs)
	return ko_star_detail_open_diary(inputs)
});