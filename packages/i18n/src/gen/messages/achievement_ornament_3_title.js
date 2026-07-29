/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Achievement_Ornament_3_TitleInputs */

const en_achievement_ornament_3_title = /** @type {(inputs: Achievement_Ornament_3_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Three ornaments`)
};

const ko_achievement_ornament_3_title = /** @type {(inputs: Achievement_Ornament_3_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`장식 셋`)
};

/**
* | output |
* | --- |
* | "Three ornaments" |
*
* @param {Achievement_Ornament_3_TitleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const achievement_ornament_3_title = /** @type {((inputs?: Achievement_Ornament_3_TitleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Achievement_Ornament_3_TitleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_achievement_ornament_3_title(inputs)
	return ko_achievement_ornament_3_title(inputs)
});