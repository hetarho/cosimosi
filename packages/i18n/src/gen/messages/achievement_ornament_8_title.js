/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Achievement_Ornament_8_TitleInputs */

const en_achievement_ornament_8_title = /** @type {(inputs: Achievement_Ornament_8_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Eight ornaments`)
};

const ko_achievement_ornament_8_title = /** @type {(inputs: Achievement_Ornament_8_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`장식 여덟`)
};

/**
* | output |
* | --- |
* | "Eight ornaments" |
*
* @param {Achievement_Ornament_8_TitleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const achievement_ornament_8_title = /** @type {((inputs?: Achievement_Ornament_8_TitleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Achievement_Ornament_8_TitleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_achievement_ornament_8_title(inputs)
	return ko_achievement_ornament_8_title(inputs)
});