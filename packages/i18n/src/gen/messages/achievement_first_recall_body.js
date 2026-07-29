/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Achievement_First_Recall_BodyInputs */

const en_achievement_first_recall_body = /** @type {(inputs: Achievement_First_Recall_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`You went back to a memory, and it changed a little.`)
};

const ko_achievement_first_recall_body = /** @type {(inputs: Achievement_First_Recall_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`기억으로 돌아갔고, 그 기억이 조금 달라졌어요.`)
};

/**
* | output |
* | --- |
* | "You went back to a memory, and it changed a little." |
*
* @param {Achievement_First_Recall_BodyInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const achievement_first_recall_body = /** @type {((inputs?: Achievement_First_Recall_BodyInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Achievement_First_Recall_BodyInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_achievement_first_recall_body(inputs)
	return ko_achievement_first_recall_body(inputs)
});