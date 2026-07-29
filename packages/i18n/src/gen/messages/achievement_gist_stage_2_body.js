/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Achievement_Gist_Stage_2_BodyInputs */

const en_achievement_gist_stage_2_body = /** @type {(inputs: Achievement_Gist_Stage_2_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`The details are going. What they meant is staying.`)
};

const ko_achievement_gist_stage_2_body = /** @type {(inputs: Achievement_Gist_Stage_2_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`세부는 지워지고, 뜻이 남고 있어요.`)
};

/**
* | output |
* | --- |
* | "The details are going. What they meant is staying." |
*
* @param {Achievement_Gist_Stage_2_BodyInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const achievement_gist_stage_2_body = /** @type {((inputs?: Achievement_Gist_Stage_2_BodyInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Achievement_Gist_Stage_2_BodyInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_achievement_gist_stage_2_body(inputs)
	return ko_achievement_gist_stage_2_body(inputs)
});