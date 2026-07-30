/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Landing_Hero_BodyInputs */

const en_landing_hero_body = /** @type {(inputs: Landing_Hero_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Write down a day and it rises as a small light. Nothing is up there yet — everything you see later, you wrote.`)
};

const ko_landing_hero_body = /** @type {(inputs: Landing_Hero_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`하루를 적으면 작은 빛이 되어 떠오릅니다. 지금 저 위에는 아무것도 없어요. 나중에 보이는 것은 모두 당신이 쓴 것입니다.`)
};

/**
* | output |
* | --- |
* | "Write down a day and it rises as a small light. Nothing is up there yet — everything you see later, you wrote." |
*
* @param {Landing_Hero_BodyInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const landing_hero_body = /** @type {((inputs?: Landing_Hero_BodyInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Landing_Hero_BodyInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_landing_hero_body(inputs)
	return ko_landing_hero_body(inputs)
});