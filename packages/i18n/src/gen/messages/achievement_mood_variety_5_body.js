/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Achievement_Mood_Variety_5_BodyInputs */

const en_achievement_mood_variety_5_body = /** @type {(inputs: Achievement_Mood_Variety_5_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`You wrote the ones that were easy to write.`)
};

const ko_achievement_mood_variety_5_body = /** @type {(inputs: Achievement_Mood_Variety_5_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`쓰기 쉬운 것들을 썼어요.`)
};

/**
* | output |
* | --- |
* | "You wrote the ones that were easy to write." |
*
* @param {Achievement_Mood_Variety_5_BodyInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const achievement_mood_variety_5_body = /** @type {((inputs?: Achievement_Mood_Variety_5_BodyInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Achievement_Mood_Variety_5_BodyInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_achievement_mood_variety_5_body(inputs)
	return ko_achievement_mood_variety_5_body(inputs)
});