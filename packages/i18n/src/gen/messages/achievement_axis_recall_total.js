/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Achievement_Axis_Recall_TotalInputs */

const en_achievement_axis_recall_total = /** @type {(inputs: Achievement_Axis_Recall_TotalInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Times remembered`)
};

const ko_achievement_axis_recall_total = /** @type {(inputs: Achievement_Axis_Recall_TotalInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`돌아본 횟수`)
};

/**
* | output |
* | --- |
* | "Times remembered" |
*
* @param {Achievement_Axis_Recall_TotalInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const achievement_axis_recall_total = /** @type {((inputs?: Achievement_Axis_Recall_TotalInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Achievement_Axis_Recall_TotalInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_achievement_axis_recall_total(inputs)
	return ko_achievement_axis_recall_total(inputs)
});