/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Achievement_Diary_5_TitleInputs */

const en_achievement_diary_5_title = /** @type {(inputs: Achievement_Diary_5_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Five diaries`)
};

const ko_achievement_diary_5_title = /** @type {(inputs: Achievement_Diary_5_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`일기 다섯`)
};

/**
* | output |
* | --- |
* | "Five diaries" |
*
* @param {Achievement_Diary_5_TitleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const achievement_diary_5_title = /** @type {((inputs?: Achievement_Diary_5_TitleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Achievement_Diary_5_TitleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_achievement_diary_5_title(inputs)
	return ko_achievement_diary_5_title(inputs)
});