/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Achievement_Recall_50_BodyInputs */

const en_achievement_recall_50_body = /** @type {(inputs: Achievement_Recall_50_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`You have been keeping things on purpose.`)
};

const ko_achievement_recall_50_body = /** @type {(inputs: Achievement_Recall_50_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`마음먹고 지켜 왔네요.`)
};

/**
* | output |
* | --- |
* | "You have been keeping things on purpose." |
*
* @param {Achievement_Recall_50_BodyInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const achievement_recall_50_body = /** @type {((inputs?: Achievement_Recall_50_BodyInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Achievement_Recall_50_BodyInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_achievement_recall_50_body(inputs)
	return ko_achievement_recall_50_body(inputs)
});