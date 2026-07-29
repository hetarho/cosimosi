/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Achievement_Mood_Variety_13_BodyInputs */

const en_achievement_mood_variety_13_body = /** @type {(inputs: Achievement_Mood_Variety_13_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Nothing was left out. Not even the flat ones.`)
};

const ko_achievement_mood_variety_13_body = /** @type {(inputs: Achievement_Mood_Variety_13_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`무엇도 빼지 않았어요. 무덤덤한 것까지요.`)
};

/**
* | output |
* | --- |
* | "Nothing was left out. Not even the flat ones." |
*
* @param {Achievement_Mood_Variety_13_BodyInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const achievement_mood_variety_13_body = /** @type {((inputs?: Achievement_Mood_Variety_13_BodyInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Achievement_Mood_Variety_13_BodyInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_achievement_mood_variety_13_body(inputs)
	return ko_achievement_mood_variety_13_body(inputs)
});