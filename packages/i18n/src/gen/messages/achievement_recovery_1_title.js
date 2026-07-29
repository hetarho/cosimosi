/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Achievement_Recovery_1_TitleInputs */

const en_achievement_recovery_1_title = /** @type {(inputs: Achievement_Recovery_1_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Brought one back`)
};

const ko_achievement_recovery_1_title = /** @type {(inputs: Achievement_Recovery_1_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`하나를 되찾음`)
};

/**
* | output |
* | --- |
* | "Brought one back" |
*
* @param {Achievement_Recovery_1_TitleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const achievement_recovery_1_title = /** @type {((inputs?: Achievement_Recovery_1_TitleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Achievement_Recovery_1_TitleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_achievement_recovery_1_title(inputs)
	return ko_achievement_recovery_1_title(inputs)
});