/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Achievement_Diary_50_TitleInputs */

const en_achievement_diary_50_title = /** @type {(inputs: Achievement_Diary_50_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Fifty diaries`)
};

const ko_achievement_diary_50_title = /** @type {(inputs: Achievement_Diary_50_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`일기 오십`)
};

/**
* | output |
* | --- |
* | "Fifty diaries" |
*
* @param {Achievement_Diary_50_TitleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const achievement_diary_50_title = /** @type {((inputs?: Achievement_Diary_50_TitleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Achievement_Diary_50_TitleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_achievement_diary_50_title(inputs)
	return ko_achievement_diary_50_title(inputs)
});