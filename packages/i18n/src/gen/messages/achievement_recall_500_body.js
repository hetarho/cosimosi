/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Achievement_Recall_500_BodyInputs */

const en_achievement_recall_500_body = /** @type {(inputs: Achievement_Recall_500_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Remembering has become something you do, not something that happens.`)
};

const ko_achievement_recall_500_body = /** @type {(inputs: Achievement_Recall_500_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`돌아보는 일이 생기는 일이 아니라 하는 일이 되었어요.`)
};

/**
* | output |
* | --- |
* | "Remembering has become something you do, not something that happens." |
*
* @param {Achievement_Recall_500_BodyInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const achievement_recall_500_body = /** @type {((inputs?: Achievement_Recall_500_BodyInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Achievement_Recall_500_BodyInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_achievement_recall_500_body(inputs)
	return ko_achievement_recall_500_body(inputs)
});