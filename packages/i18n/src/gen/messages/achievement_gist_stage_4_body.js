/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Achievement_Gist_Stage_4_BodyInputs */

const en_achievement_gist_stage_4_body = /** @type {(inputs: Achievement_Gist_Stage_4_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`A single line that holds a whole day.`)
};

const ko_achievement_gist_stage_4_body = /** @type {(inputs: Achievement_Gist_Stage_4_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`하루를 담은 한 줄이에요.`)
};

/**
* | output |
* | --- |
* | "A single line that holds a whole day." |
*
* @param {Achievement_Gist_Stage_4_BodyInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const achievement_gist_stage_4_body = /** @type {((inputs?: Achievement_Gist_Stage_4_BodyInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Achievement_Gist_Stage_4_BodyInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_achievement_gist_stage_4_body(inputs)
	return ko_achievement_gist_stage_4_body(inputs)
});