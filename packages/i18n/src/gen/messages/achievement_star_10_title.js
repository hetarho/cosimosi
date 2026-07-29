/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Achievement_Star_10_TitleInputs */

const en_achievement_star_10_title = /** @type {(inputs: Achievement_Star_10_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Ten stars`)
};

const ko_achievement_star_10_title = /** @type {(inputs: Achievement_Star_10_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`별 열`)
};

/**
* | output |
* | --- |
* | "Ten stars" |
*
* @param {Achievement_Star_10_TitleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const achievement_star_10_title = /** @type {((inputs?: Achievement_Star_10_TitleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Achievement_Star_10_TitleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_achievement_star_10_title(inputs)
	return ko_achievement_star_10_title(inputs)
});