/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Achievement_First_Release_TitleInputs */

const en_achievement_first_release_title = /** @type {(inputs: Achievement_First_Release_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Let one go`)
};

const ko_achievement_first_release_title = /** @type {(inputs: Achievement_First_Release_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`하나를 놓아줌`)
};

/**
* | output |
* | --- |
* | "Let one go" |
*
* @param {Achievement_First_Release_TitleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const achievement_first_release_title = /** @type {((inputs?: Achievement_First_Release_TitleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Achievement_First_Release_TitleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_achievement_first_release_title(inputs)
	return ko_achievement_first_release_title(inputs)
});