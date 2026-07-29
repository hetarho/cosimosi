/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Achievement_Star_200_TitleInputs */

const en_achievement_star_200_title = /** @type {(inputs: Achievement_Star_200_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Two hundred stars`)
};

const ko_achievement_star_200_title = /** @type {(inputs: Achievement_Star_200_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`별 이백`)
};

/**
* | output |
* | --- |
* | "Two hundred stars" |
*
* @param {Achievement_Star_200_TitleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const achievement_star_200_title = /** @type {((inputs?: Achievement_Star_200_TitleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Achievement_Star_200_TitleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_achievement_star_200_title(inputs)
	return ko_achievement_star_200_title(inputs)
});