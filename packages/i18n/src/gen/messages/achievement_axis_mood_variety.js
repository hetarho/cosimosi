/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Achievement_Axis_Mood_VarietyInputs */

const en_achievement_axis_mood_variety = /** @type {(inputs: Achievement_Axis_Mood_VarietyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Feelings recorded`)
};

const ko_achievement_axis_mood_variety = /** @type {(inputs: Achievement_Axis_Mood_VarietyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`적어둔 감정`)
};

/**
* | output |
* | --- |
* | "Feelings recorded" |
*
* @param {Achievement_Axis_Mood_VarietyInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const achievement_axis_mood_variety = /** @type {((inputs?: Achievement_Axis_Mood_VarietyInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Achievement_Axis_Mood_VarietyInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_achievement_axis_mood_variety(inputs)
	return ko_achievement_axis_mood_variety(inputs)
});