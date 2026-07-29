/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Achievement_Axis_Star_TotalInputs */

const en_achievement_axis_star_total = /** @type {(inputs: Achievement_Axis_Star_TotalInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Stars launched`)
};

const ko_achievement_axis_star_total = /** @type {(inputs: Achievement_Axis_Star_TotalInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`띄운 별`)
};

/**
* | output |
* | --- |
* | "Stars launched" |
*
* @param {Achievement_Axis_Star_TotalInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const achievement_axis_star_total = /** @type {((inputs?: Achievement_Axis_Star_TotalInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Achievement_Axis_Star_TotalInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_achievement_axis_star_total(inputs)
	return ko_achievement_axis_star_total(inputs)
});