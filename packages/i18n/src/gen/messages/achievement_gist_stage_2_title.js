/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Achievement_Gist_Stage_2_TitleInputs */

const en_achievement_gist_stage_2_title = /** @type {(inputs: Achievement_Gist_Stage_2_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Two steps up`)
};

const ko_achievement_gist_stage_2_title = /** @type {(inputs: Achievement_Gist_Stage_2_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`두 걸음 올라감`)
};

/**
* | output |
* | --- |
* | "Two steps up" |
*
* @param {Achievement_Gist_Stage_2_TitleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const achievement_gist_stage_2_title = /** @type {((inputs?: Achievement_Gist_Stage_2_TitleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Achievement_Gist_Stage_2_TitleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_achievement_gist_stage_2_title(inputs)
	return ko_achievement_gist_stage_2_title(inputs)
});