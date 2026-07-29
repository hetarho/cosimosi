/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Achievement_Ornament_Kind_2_BodyInputs */

const en_achievement_ornament_kind_2_body = /** @type {(inputs: Achievement_Ornament_Kind_2_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`The sky behind, and the shape a memory takes.`)
};

const ko_achievement_ornament_kind_2_body = /** @type {(inputs: Achievement_Ornament_Kind_2_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`뒤의 하늘과, 기억이 갖는 모양.`)
};

/**
* | output |
* | --- |
* | "The sky behind, and the shape a memory takes." |
*
* @param {Achievement_Ornament_Kind_2_BodyInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const achievement_ornament_kind_2_body = /** @type {((inputs?: Achievement_Ornament_Kind_2_BodyInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Achievement_Ornament_Kind_2_BodyInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_achievement_ornament_kind_2_body(inputs)
	return ko_achievement_ornament_kind_2_body(inputs)
});