/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Achievement_Axis_Diary_TotalInputs */

const en_achievement_axis_diary_total = /** @type {(inputs: Achievement_Axis_Diary_TotalInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Diaries written`)
};

const ko_achievement_axis_diary_total = /** @type {(inputs: Achievement_Axis_Diary_TotalInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`쓴 일기`)
};

/**
* | output |
* | --- |
* | "Diaries written" |
*
* @param {Achievement_Axis_Diary_TotalInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const achievement_axis_diary_total = /** @type {((inputs?: Achievement_Axis_Diary_TotalInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Achievement_Axis_Diary_TotalInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_achievement_axis_diary_total(inputs)
	return ko_achievement_axis_diary_total(inputs)
});