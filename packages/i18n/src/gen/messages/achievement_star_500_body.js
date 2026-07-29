/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Achievement_Star_500_BodyInputs */

const en_achievement_star_500_body = /** @type {(inputs: Achievement_Star_500_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`A sky worth a shape nobody else has.`)
};

const ko_achievement_star_500_body = /** @type {(inputs: Achievement_Star_500_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`누구와도 겹치지 않는 모양의 하늘이에요.`)
};

/**
* | output |
* | --- |
* | "A sky worth a shape nobody else has." |
*
* @param {Achievement_Star_500_BodyInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const achievement_star_500_body = /** @type {((inputs?: Achievement_Star_500_BodyInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Achievement_Star_500_BodyInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_achievement_star_500_body(inputs)
	return ko_achievement_star_500_body(inputs)
});