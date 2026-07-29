/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Achievement_Recall_10_BodyInputs */

const en_achievement_recall_10_body = /** @type {(inputs: Achievement_Recall_10_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Each time you go back, it holds a little longer.`)
};

const ko_achievement_recall_10_body = /** @type {(inputs: Achievement_Recall_10_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`돌아갈 때마다 조금 더 오래 남아요.`)
};

/**
* | output |
* | --- |
* | "Each time you go back, it holds a little longer." |
*
* @param {Achievement_Recall_10_BodyInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const achievement_recall_10_body = /** @type {((inputs?: Achievement_Recall_10_BodyInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Achievement_Recall_10_BodyInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_achievement_recall_10_body(inputs)
	return ko_achievement_recall_10_body(inputs)
});