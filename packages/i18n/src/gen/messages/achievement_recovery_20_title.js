/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Achievement_Recovery_20_TitleInputs */

const en_achievement_recovery_20_title = /** @type {(inputs: Achievement_Recovery_20_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Brought twenty back`)
};

const ko_achievement_recovery_20_title = /** @type {(inputs: Achievement_Recovery_20_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`스물을 되찾음`)
};

/**
* | output |
* | --- |
* | "Brought twenty back" |
*
* @param {Achievement_Recovery_20_TitleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const achievement_recovery_20_title = /** @type {((inputs?: Achievement_Recovery_20_TitleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Achievement_Recovery_20_TitleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_achievement_recovery_20_title(inputs)
	return ko_achievement_recovery_20_title(inputs)
});