/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Achievement_First_Star_TitleInputs */

const en_achievement_first_star_title = /** @type {(inputs: Achievement_First_Star_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`The first star`)
};

const ko_achievement_first_star_title = /** @type {(inputs: Achievement_First_Star_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`첫 별`)
};

/**
* | output |
* | --- |
* | "The first star" |
*
* @param {Achievement_First_Star_TitleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const achievement_first_star_title = /** @type {((inputs?: Achievement_First_Star_TitleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Achievement_First_Star_TitleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_achievement_first_star_title(inputs)
	return ko_achievement_first_star_title(inputs)
});