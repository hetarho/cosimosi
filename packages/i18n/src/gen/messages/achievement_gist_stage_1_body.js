/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Achievement_Gist_Stage_1_BodyInputs */

const en_achievement_gist_stage_1_body = /** @type {(inputs: Achievement_Gist_Stage_1_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`A memory started to be about something rather than to be it.`)
};

const ko_achievement_gist_stage_1_body = /** @type {(inputs: Achievement_Gist_Stage_1_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`기억이 그것이기보다 그것에 대한 것이 되기 시작했어요.`)
};

/**
* | output |
* | --- |
* | "A memory started to be about something rather than to be it." |
*
* @param {Achievement_Gist_Stage_1_BodyInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const achievement_gist_stage_1_body = /** @type {((inputs?: Achievement_Gist_Stage_1_BodyInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Achievement_Gist_Stage_1_BodyInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_achievement_gist_stage_1_body(inputs)
	return ko_achievement_gist_stage_1_body(inputs)
});