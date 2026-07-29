/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Error_Achievement_Reward_UnavailableInputs */

const en_error_achievement_reward_unavailable = /** @type {(inputs: Error_Achievement_Reward_UnavailableInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`The reward is kept. Try receiving it again.`)
};

const ko_error_achievement_reward_unavailable = /** @type {(inputs: Error_Achievement_Reward_UnavailableInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`보상은 그대로 있어요. 다시 받아 보세요.`)
};

/**
* | output |
* | --- |
* | "The reward is kept. Try receiving it again." |
*
* @param {Error_Achievement_Reward_UnavailableInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const error_achievement_reward_unavailable = /** @type {((inputs?: Error_Achievement_Reward_UnavailableInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Error_Achievement_Reward_UnavailableInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_error_achievement_reward_unavailable(inputs)
	return ko_error_achievement_reward_unavailable(inputs)
});