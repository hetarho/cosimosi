/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Achievement_Ornament_3_BodyInputs */

const en_achievement_ornament_3_body = /** @type {(inputs: Achievement_Ornament_3_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Enough to choose between.`)
};

const ko_achievement_ornament_3_body = /** @type {(inputs: Achievement_Ornament_3_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`고를 수 있을 만큼 되었어요.`)
};

/**
* | output |
* | --- |
* | "Enough to choose between." |
*
* @param {Achievement_Ornament_3_BodyInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const achievement_ornament_3_body = /** @type {((inputs?: Achievement_Ornament_3_BodyInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Achievement_Ornament_3_BodyInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_achievement_ornament_3_body(inputs)
	return ko_achievement_ornament_3_body(inputs)
});