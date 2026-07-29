/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Achievement_Mood_Variety_9_TitleInputs */

const en_achievement_mood_variety_9_title = /** @type {(inputs: Achievement_Mood_Variety_9_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Nine feelings`)
};

const ko_achievement_mood_variety_9_title = /** @type {(inputs: Achievement_Mood_Variety_9_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`감정 아홉`)
};

/**
* | output |
* | --- |
* | "Nine feelings" |
*
* @param {Achievement_Mood_Variety_9_TitleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const achievement_mood_variety_9_title = /** @type {((inputs?: Achievement_Mood_Variety_9_TitleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Achievement_Mood_Variety_9_TitleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_achievement_mood_variety_9_title(inputs)
	return ko_achievement_mood_variety_9_title(inputs)
});