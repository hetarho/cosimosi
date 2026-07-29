/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Achievement_Reveal_TitleInputs */

const en_achievement_reveal_title = /** @type {(inputs: Achievement_Reveal_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Received`)
};

const ko_achievement_reveal_title = /** @type {(inputs: Achievement_Reveal_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`받았어요`)
};

/**
* | output |
* | --- |
* | "Received" |
*
* @param {Achievement_Reveal_TitleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const achievement_reveal_title = /** @type {((inputs?: Achievement_Reveal_TitleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Achievement_Reveal_TitleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_achievement_reveal_title(inputs)
	return ko_achievement_reveal_title(inputs)
});