/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Achievement_Diary_200_BodyInputs */

const en_achievement_diary_200_body = /** @type {(inputs: Achievement_Diary_200_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`A universe you could get lost in.`)
};

const ko_achievement_diary_200_body = /** @type {(inputs: Achievement_Diary_200_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`길을 잃어도 좋을 만한 우주예요.`)
};

/**
* | output |
* | --- |
* | "A universe you could get lost in." |
*
* @param {Achievement_Diary_200_BodyInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const achievement_diary_200_body = /** @type {((inputs?: Achievement_Diary_200_BodyInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Achievement_Diary_200_BodyInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_achievement_diary_200_body(inputs)
	return ko_achievement_diary_200_body(inputs)
});