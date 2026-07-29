/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Achievement_Mood_Variety_9_BodyInputs */

const en_achievement_mood_variety_9_body = /** @type {(inputs: Achievement_Mood_Variety_9_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Including some you would rather have skipped.`)
};

const ko_achievement_mood_variety_9_body = /** @type {(inputs: Achievement_Mood_Variety_9_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`건너뛰고 싶었던 것들까지요.`)
};

/**
* | output |
* | --- |
* | "Including some you would rather have skipped." |
*
* @param {Achievement_Mood_Variety_9_BodyInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const achievement_mood_variety_9_body = /** @type {((inputs?: Achievement_Mood_Variety_9_BodyInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Achievement_Mood_Variety_9_BodyInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_achievement_mood_variety_9_body(inputs)
	return ko_achievement_mood_variety_9_body(inputs)
});