/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ amount: NonNullable<unknown> }} Achievement_Reward_TwinkleInputs */

const en_achievement_reward_twinkle = /** @type {(inputs: Achievement_Reward_TwinkleInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.amount} stardust`)
};

const ko_achievement_reward_twinkle = /** @type {(inputs: Achievement_Reward_TwinkleInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`별가루 ${i?.amount}`)
};

/**
* | output |
* | --- |
* | "{amount} stardust" |
*
* @param {Achievement_Reward_TwinkleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const achievement_reward_twinkle = /** @type {((inputs: Achievement_Reward_TwinkleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Achievement_Reward_TwinkleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_achievement_reward_twinkle(inputs)
	return ko_achievement_reward_twinkle(inputs)
});