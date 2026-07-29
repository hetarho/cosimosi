/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Achievement_Ornament_8_BodyInputs */

const en_achievement_ornament_8_body = /** @type {(inputs: Achievement_Ornament_8_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`A wardrobe for a universe.`)
};

const ko_achievement_ornament_8_body = /** @type {(inputs: Achievement_Ornament_8_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`우주의 옷장이네요.`)
};

/**
* | output |
* | --- |
* | "A wardrobe for a universe." |
*
* @param {Achievement_Ornament_8_BodyInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const achievement_ornament_8_body = /** @type {((inputs?: Achievement_Ornament_8_BodyInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Achievement_Ornament_8_BodyInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_achievement_ornament_8_body(inputs)
	return ko_achievement_ornament_8_body(inputs)
});