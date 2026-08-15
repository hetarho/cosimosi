/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Achievement_Ornament_Kind_5_BodyInputs */

const en_achievement_ornament_kind_5_body = /** @type {(inputs: Achievement_Ornament_Kind_5_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`The sky, both bodies, and the light scattered between them.`)
};

const ko_achievement_ornament_kind_5_body = /** @type {(inputs: Achievement_Ornament_Kind_5_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`하늘도, 두 몸도, 그 사이에 뿌려진 빛까지.`)
};

/**
* | output |
* | --- |
* | "The sky, both bodies, and the light scattered between them." |
*
* @param {Achievement_Ornament_Kind_5_BodyInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const achievement_ornament_kind_5_body = /** @type {((inputs?: Achievement_Ornament_Kind_5_BodyInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Achievement_Ornament_Kind_5_BodyInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_achievement_ornament_kind_5_body(inputs)
	return ko_achievement_ornament_kind_5_body(inputs)
});