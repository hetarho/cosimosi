/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Achievement_First_Diary_TitleInputs */

const en_achievement_first_diary_title = /** @type {(inputs: Achievement_First_Diary_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`The first diary`)
};

const ko_achievement_first_diary_title = /** @type {(inputs: Achievement_First_Diary_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`첫 일기`)
};

/**
* | output |
* | --- |
* | "The first diary" |
*
* @param {Achievement_First_Diary_TitleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const achievement_first_diary_title = /** @type {((inputs?: Achievement_First_Diary_TitleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Achievement_First_Diary_TitleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_achievement_first_diary_title(inputs)
	return ko_achievement_first_diary_title(inputs)
});