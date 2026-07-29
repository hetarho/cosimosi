/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Achievement_First_Star_BodyInputs */

const en_achievement_first_star_body = /** @type {(inputs: Achievement_First_Star_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`A memory took a body and found a place in the dark.`)
};

const ko_achievement_first_star_body = /** @type {(inputs: Achievement_First_Star_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`기억이 몸을 얻어 어둠 속에 자리를 잡았어요.`)
};

/**
* | output |
* | --- |
* | "A memory took a body and found a place in the dark." |
*
* @param {Achievement_First_Star_BodyInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const achievement_first_star_body = /** @type {((inputs?: Achievement_First_Star_BodyInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Achievement_First_Star_BodyInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_achievement_first_star_body(inputs)
	return ko_achievement_first_star_body(inputs)
});