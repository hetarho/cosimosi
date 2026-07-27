/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Twinkle_Earn_Achievement_BodyInputs */

const en_twinkle_earn_achievement_body = /** @type {(inputs: Twinkle_Earn_Achievement_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Take what you reached while the universe grew.`)
};

const ko_twinkle_earn_achievement_body = /** @type {(inputs: Twinkle_Earn_Achievement_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`우주가 자라는 동안 이룬 것들을 받아 가요.`)
};

/**
* | output |
* | --- |
* | "Take what you reached while the universe grew." |
*
* @param {Twinkle_Earn_Achievement_BodyInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const twinkle_earn_achievement_body = /** @type {((inputs?: Twinkle_Earn_Achievement_BodyInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Twinkle_Earn_Achievement_BodyInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_twinkle_earn_achievement_body(inputs)
	return ko_twinkle_earn_achievement_body(inputs)
});