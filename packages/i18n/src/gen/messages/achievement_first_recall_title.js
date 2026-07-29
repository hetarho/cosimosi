/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Achievement_First_Recall_TitleInputs */

const en_achievement_first_recall_title = /** @type {(inputs: Achievement_First_Recall_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Remembered once`)
};

const ko_achievement_first_recall_title = /** @type {(inputs: Achievement_First_Recall_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`한 번 돌아봄`)
};

/**
* | output |
* | --- |
* | "Remembered once" |
*
* @param {Achievement_First_Recall_TitleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const achievement_first_recall_title = /** @type {((inputs?: Achievement_First_Recall_TitleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Achievement_First_Recall_TitleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_achievement_first_recall_title(inputs)
	return ko_achievement_first_recall_title(inputs)
});