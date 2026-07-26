/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ amount: NonNullable<unknown> }} Invite_Reward_LineInputs */

const en_invite_reward_line = /** @type {(inputs: Invite_Reward_LineInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`After their first star, you receive ${i?.amount} stardust.`)
};

const ko_invite_reward_line = /** @type {(inputs: Invite_Reward_LineInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`첫 별이 태어나면 별가루 ${i?.amount}개를 받아요.`)
};

/**
* | output |
* | --- |
* | "After their first star, you receive {amount} stardust." |
*
* @param {Invite_Reward_LineInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const invite_reward_line = /** @type {((inputs: Invite_Reward_LineInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Invite_Reward_LineInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_invite_reward_line(inputs)
	return ko_invite_reward_line(inputs)
});