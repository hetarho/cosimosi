/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Twinkle_Earn_Achievement_ActionInputs */

const en_twinkle_earn_achievement_action = /** @type {(inputs: Twinkle_Earn_Achievement_ActionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`See achievements`)
};

const ko_twinkle_earn_achievement_action = /** @type {(inputs: Twinkle_Earn_Achievement_ActionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`업적 보러 가기`)
};

/**
* | output |
* | --- |
* | "See achievements" |
*
* @param {Twinkle_Earn_Achievement_ActionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const twinkle_earn_achievement_action = /** @type {((inputs?: Twinkle_Earn_Achievement_ActionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Twinkle_Earn_Achievement_ActionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_twinkle_earn_achievement_action(inputs)
	return ko_twinkle_earn_achievement_action(inputs)
});