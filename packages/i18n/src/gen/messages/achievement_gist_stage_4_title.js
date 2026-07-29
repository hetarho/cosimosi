/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Achievement_Gist_Stage_4_TitleInputs */

const en_achievement_gist_stage_4_title = /** @type {(inputs: Achievement_Gist_Stage_4_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`All the way up`)
};

const ko_achievement_gist_stage_4_title = /** @type {(inputs: Achievement_Gist_Stage_4_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`끝까지 올라감`)
};

/**
* | output |
* | --- |
* | "All the way up" |
*
* @param {Achievement_Gist_Stage_4_TitleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const achievement_gist_stage_4_title = /** @type {((inputs?: Achievement_Gist_Stage_4_TitleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Achievement_Gist_Stage_4_TitleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_achievement_gist_stage_4_title(inputs)
	return ko_achievement_gist_stage_4_title(inputs)
});