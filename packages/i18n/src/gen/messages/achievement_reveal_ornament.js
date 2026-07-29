/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Achievement_Reveal_OrnamentInputs */

const en_achievement_reveal_ornament = /** @type {(inputs: Achievement_Reveal_OrnamentInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`An ornament is yours. It is waiting where you dress your universe.`)
};

const ko_achievement_reveal_ornament = /** @type {(inputs: Achievement_Reveal_OrnamentInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`장식이 하나 생겼어요. 우주를 꾸미는 곳에서 기다립니다.`)
};

/**
* | output |
* | --- |
* | "An ornament is yours. It is waiting where you dress your universe." |
*
* @param {Achievement_Reveal_OrnamentInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const achievement_reveal_ornament = /** @type {((inputs?: Achievement_Reveal_OrnamentInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Achievement_Reveal_OrnamentInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_achievement_reveal_ornament(inputs)
	return ko_achievement_reveal_ornament(inputs)
});