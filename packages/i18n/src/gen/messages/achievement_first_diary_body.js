/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Achievement_First_Diary_BodyInputs */

const en_achievement_first_diary_body = /** @type {(inputs: Achievement_First_Diary_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`You wrote once, and a universe had something to hold.`)
};

const ko_achievement_first_diary_body = /** @type {(inputs: Achievement_First_Diary_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`한 번 썼고, 우주가 품을 것이 생겼어요.`)
};

/**
* | output |
* | --- |
* | "You wrote once, and a universe had something to hold." |
*
* @param {Achievement_First_Diary_BodyInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const achievement_first_diary_body = /** @type {((inputs?: Achievement_First_Diary_BodyInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Achievement_First_Diary_BodyInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_achievement_first_diary_body(inputs)
	return ko_achievement_first_diary_body(inputs)
});