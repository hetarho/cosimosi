/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Achievement_Reveal_DismissInputs */

const en_achievement_reveal_dismiss = /** @type {(inputs: Achievement_Reveal_DismissInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Close`)
};

const ko_achievement_reveal_dismiss = /** @type {(inputs: Achievement_Reveal_DismissInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`닫기`)
};

/**
* | output |
* | --- |
* | "Close" |
*
* @param {Achievement_Reveal_DismissInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const achievement_reveal_dismiss = /** @type {((inputs?: Achievement_Reveal_DismissInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Achievement_Reveal_DismissInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_achievement_reveal_dismiss(inputs)
	return ko_achievement_reveal_dismiss(inputs)
});