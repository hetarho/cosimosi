/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Achievement_Mood_Variety_5_TitleInputs */

const en_achievement_mood_variety_5_title = /** @type {(inputs: Achievement_Mood_Variety_5_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Five feelings`)
};

const ko_achievement_mood_variety_5_title = /** @type {(inputs: Achievement_Mood_Variety_5_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`감정 다섯`)
};

/**
* | output |
* | --- |
* | "Five feelings" |
*
* @param {Achievement_Mood_Variety_5_TitleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const achievement_mood_variety_5_title = /** @type {((inputs?: Achievement_Mood_Variety_5_TitleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Achievement_Mood_Variety_5_TitleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_achievement_mood_variety_5_title(inputs)
	return ko_achievement_mood_variety_5_title(inputs)
});