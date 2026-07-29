/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Achievement_Diary_50_BodyInputs */

const en_achievement_diary_50_body = /** @type {(inputs: Achievement_Diary_50_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Long enough that the early ones have begun to fade.`)
};

const ko_achievement_diary_50_body = /** @type {(inputs: Achievement_Diary_50_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`처음 것들이 이미 흐려질 만큼 지났어요.`)
};

/**
* | output |
* | --- |
* | "Long enough that the early ones have begun to fade." |
*
* @param {Achievement_Diary_50_BodyInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const achievement_diary_50_body = /** @type {((inputs?: Achievement_Diary_50_BodyInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Achievement_Diary_50_BodyInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_achievement_diary_50_body(inputs)
	return ko_achievement_diary_50_body(inputs)
});