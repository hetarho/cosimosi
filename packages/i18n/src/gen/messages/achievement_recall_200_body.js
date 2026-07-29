/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Achievement_Recall_200_BodyInputs */

const en_achievement_recall_200_body = /** @type {(inputs: Achievement_Recall_200_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`The brightest parts of this sky are the ones you returned to.`)
};

const ko_achievement_recall_200_body = /** @type {(inputs: Achievement_Recall_200_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`이 하늘에서 가장 밝은 곳은 당신이 돌아간 자리예요.`)
};

/**
* | output |
* | --- |
* | "The brightest parts of this sky are the ones you returned to." |
*
* @param {Achievement_Recall_200_BodyInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const achievement_recall_200_body = /** @type {((inputs?: Achievement_Recall_200_BodyInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Achievement_Recall_200_BodyInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_achievement_recall_200_body(inputs)
	return ko_achievement_recall_200_body(inputs)
});