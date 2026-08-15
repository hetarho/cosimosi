/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Achievement_Ornament_Kind_2_TitleInputs */

const en_achievement_ornament_kind_2_title = /** @type {(inputs: Achievement_Ornament_Kind_2_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Two surfaces changed`)
};

const ko_achievement_ornament_kind_2_title = /** @type {(inputs: Achievement_Ornament_Kind_2_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`두 군데를 바꿈`)
};

/**
* | output |
* | --- |
* | "Two surfaces changed" |
*
* @param {Achievement_Ornament_Kind_2_TitleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const achievement_ornament_kind_2_title = /** @type {((inputs?: Achievement_Ornament_Kind_2_TitleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Achievement_Ornament_Kind_2_TitleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_achievement_ornament_kind_2_title(inputs)
	return ko_achievement_ornament_kind_2_title(inputs)
});