/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Achievement_Ornament_Kind_5_TitleInputs */

const en_achievement_ornament_kind_5_title = /** @type {(inputs: Achievement_Ornament_Kind_5_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`All of it yours`)
};

const ko_achievement_ornament_kind_5_title = /** @type {(inputs: Achievement_Ornament_Kind_5_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`전부 내 손으로`)
};

/**
* | output |
* | --- |
* | "All of it yours" |
*
* @param {Achievement_Ornament_Kind_5_TitleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const achievement_ornament_kind_5_title = /** @type {((inputs?: Achievement_Ornament_Kind_5_TitleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Achievement_Ornament_Kind_5_TitleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_achievement_ornament_kind_5_title(inputs)
	return ko_achievement_ornament_kind_5_title(inputs)
});