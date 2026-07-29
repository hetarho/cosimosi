/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Achievement_Diary_5_BodyInputs */

const en_achievement_diary_5_body = /** @type {(inputs: Achievement_Diary_5_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Enough that a habit is starting to look like one.`)
};

const ko_achievement_diary_5_body = /** @type {(inputs: Achievement_Diary_5_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`습관이라 부를 만한 모양이 잡히기 시작했어요.`)
};

/**
* | output |
* | --- |
* | "Enough that a habit is starting to look like one." |
*
* @param {Achievement_Diary_5_BodyInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const achievement_diary_5_body = /** @type {((inputs?: Achievement_Diary_5_BodyInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Achievement_Diary_5_BodyInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_achievement_diary_5_body(inputs)
	return ko_achievement_diary_5_body(inputs)
});