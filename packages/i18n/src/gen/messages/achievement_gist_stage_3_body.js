/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Achievement_Gist_Stage_3_BodyInputs */

const en_achievement_gist_stage_3_body = /** @type {(inputs: Achievement_Gist_Stage_3_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Almost only the shape is left, and the shape is the point.`)
};

const ko_achievement_gist_stage_3_body = /** @type {(inputs: Achievement_Gist_Stage_3_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`거의 형태만 남았고, 그 형태가 핵심이에요.`)
};

/**
* | output |
* | --- |
* | "Almost only the shape is left, and the shape is the point." |
*
* @param {Achievement_Gist_Stage_3_BodyInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const achievement_gist_stage_3_body = /** @type {((inputs?: Achievement_Gist_Stage_3_BodyInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Achievement_Gist_Stage_3_BodyInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_achievement_gist_stage_3_body(inputs)
	return ko_achievement_gist_stage_3_body(inputs)
});