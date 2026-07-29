/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Achievement_Reward_OrnamentInputs */

const en_achievement_reward_ornament = /** @type {(inputs: Achievement_Reward_OrnamentInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`An ornament, only from here`)
};

const ko_achievement_reward_ornament = /** @type {(inputs: Achievement_Reward_OrnamentInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`여기서만 얻는 장식`)
};

/**
* | output |
* | --- |
* | "An ornament, only from here" |
*
* @param {Achievement_Reward_OrnamentInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const achievement_reward_ornament = /** @type {((inputs?: Achievement_Reward_OrnamentInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Achievement_Reward_OrnamentInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_achievement_reward_ornament(inputs)
	return ko_achievement_reward_ornament(inputs)
});