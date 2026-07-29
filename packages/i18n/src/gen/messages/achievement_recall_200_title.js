/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Achievement_Recall_200_TitleInputs */

const en_achievement_recall_200_title = /** @type {(inputs: Achievement_Recall_200_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Remembered two hundred times`)
};

const ko_achievement_recall_200_title = /** @type {(inputs: Achievement_Recall_200_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`이백 번 돌아봄`)
};

/**
* | output |
* | --- |
* | "Remembered two hundred times" |
*
* @param {Achievement_Recall_200_TitleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const achievement_recall_200_title = /** @type {((inputs?: Achievement_Recall_200_TitleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Achievement_Recall_200_TitleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_achievement_recall_200_title(inputs)
	return ko_achievement_recall_200_title(inputs)
});