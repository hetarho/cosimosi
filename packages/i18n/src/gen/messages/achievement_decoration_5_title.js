/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Achievement_Decoration_5_TitleInputs */

const en_achievement_decoration_5_title = /** @type {(inputs: Achievement_Decoration_5_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Dressed it five times`)
};

const ko_achievement_decoration_5_title = /** @type {(inputs: Achievement_Decoration_5_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`다섯 번 꾸밈`)
};

/**
* | output |
* | --- |
* | "Dressed it five times" |
*
* @param {Achievement_Decoration_5_TitleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const achievement_decoration_5_title = /** @type {((inputs?: Achievement_Decoration_5_TitleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Achievement_Decoration_5_TitleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_achievement_decoration_5_title(inputs)
	return ko_achievement_decoration_5_title(inputs)
});