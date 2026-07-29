/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Achievement_Diary_20_BodyInputs */

const en_achievement_diary_20_body = /** @type {(inputs: Achievement_Diary_20_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`A season of writing, more or less.`)
};

const ko_achievement_diary_20_body = /** @type {(inputs: Achievement_Diary_20_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`한 계절 정도의 기록이에요.`)
};

/**
* | output |
* | --- |
* | "A season of writing, more or less." |
*
* @param {Achievement_Diary_20_BodyInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const achievement_diary_20_body = /** @type {((inputs?: Achievement_Diary_20_BodyInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Achievement_Diary_20_BodyInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_achievement_diary_20_body(inputs)
	return ko_achievement_diary_20_body(inputs)
});