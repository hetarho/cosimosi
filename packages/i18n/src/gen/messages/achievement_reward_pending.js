/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Achievement_Reward_PendingInputs */

const en_achievement_reward_pending = /** @type {(inputs: Achievement_Reward_PendingInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`The reward has not arrived yet.`)
};

const ko_achievement_reward_pending = /** @type {(inputs: Achievement_Reward_PendingInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`보상이 아직 도착하지 않았어요.`)
};

/**
* | output |
* | --- |
* | "The reward has not arrived yet." |
*
* @param {Achievement_Reward_PendingInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const achievement_reward_pending = /** @type {((inputs?: Achievement_Reward_PendingInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Achievement_Reward_PendingInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_achievement_reward_pending(inputs)
	return ko_achievement_reward_pending(inputs)
});