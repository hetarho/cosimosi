/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Achievement_Decoration_20_TitleInputs */

const en_achievement_decoration_20_title = /** @type {(inputs: Achievement_Decoration_20_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Dressed it twenty times`)
};

const ko_achievement_decoration_20_title = /** @type {(inputs: Achievement_Decoration_20_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`스무 번 꾸밈`)
};

/**
* | output |
* | --- |
* | "Dressed it twenty times" |
*
* @param {Achievement_Decoration_20_TitleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const achievement_decoration_20_title = /** @type {((inputs?: Achievement_Decoration_20_TitleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Achievement_Decoration_20_TitleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_achievement_decoration_20_title(inputs)
	return ko_achievement_decoration_20_title(inputs)
});