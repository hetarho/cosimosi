/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Achievement_First_Gist_View_TitleInputs */

const en_achievement_first_gist_view_title = /** @type {(inputs: Achievement_First_Gist_View_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`The first soul`)
};

const ko_achievement_first_gist_view_title = /** @type {(inputs: Achievement_First_Gist_View_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`첫 영혼`)
};

/**
* | output |
* | --- |
* | "The first soul" |
*
* @param {Achievement_First_Gist_View_TitleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const achievement_first_gist_view_title = /** @type {((inputs?: Achievement_First_Gist_View_TitleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Achievement_First_Gist_View_TitleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_achievement_first_gist_view_title(inputs)
	return ko_achievement_first_gist_view_title(inputs)
});