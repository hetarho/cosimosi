/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Achievement_Axis_First_ExperienceInputs */

const en_achievement_axis_first_experience = /** @type {(inputs: Achievement_Axis_First_ExperienceInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`First times`)
};

const ko_achievement_axis_first_experience = /** @type {(inputs: Achievement_Axis_First_ExperienceInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`처음`)
};

/**
* | output |
* | --- |
* | "First times" |
*
* @param {Achievement_Axis_First_ExperienceInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const achievement_axis_first_experience = /** @type {((inputs?: Achievement_Axis_First_ExperienceInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Achievement_Axis_First_ExperienceInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_achievement_axis_first_experience(inputs)
	return ko_achievement_axis_first_experience(inputs)
});