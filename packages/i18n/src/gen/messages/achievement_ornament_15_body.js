/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Achievement_Ornament_15_BodyInputs */

const en_achievement_ornament_15_body = /** @type {(inputs: Achievement_Ornament_15_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Almost everything the sky can wear.`)
};

const ko_achievement_ornament_15_body = /** @type {(inputs: Achievement_Ornament_15_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`하늘이 입을 수 있는 것 거의 전부예요.`)
};

/**
* | output |
* | --- |
* | "Almost everything the sky can wear." |
*
* @param {Achievement_Ornament_15_BodyInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const achievement_ornament_15_body = /** @type {((inputs?: Achievement_Ornament_15_BodyInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Achievement_Ornament_15_BodyInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_achievement_ornament_15_body(inputs)
	return ko_achievement_ornament_15_body(inputs)
});