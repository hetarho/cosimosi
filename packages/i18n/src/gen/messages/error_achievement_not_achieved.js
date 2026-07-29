/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Error_Achievement_Not_AchievedInputs */

const en_error_achievement_not_achieved = /** @type {(inputs: Error_Achievement_Not_AchievedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Not reached yet. The list has been refreshed.`)
};

const ko_error_achievement_not_achieved = /** @type {(inputs: Error_Achievement_Not_AchievedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`아직 닿지 않았어요. 목록을 새로 불러왔습니다.`)
};

/**
* | output |
* | --- |
* | "Not reached yet. The list has been refreshed." |
*
* @param {Error_Achievement_Not_AchievedInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const error_achievement_not_achieved = /** @type {((inputs?: Error_Achievement_Not_AchievedInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Error_Achievement_Not_AchievedInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_error_achievement_not_achieved(inputs)
	return ko_error_achievement_not_achieved(inputs)
});