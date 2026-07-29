/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Error_Achievement_Not_FoundInputs */

const en_error_achievement_not_found = /** @type {(inputs: Error_Achievement_Not_FoundInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`That record is gone. The list has been refreshed.`)
};

const ko_error_achievement_not_found = /** @type {(inputs: Error_Achievement_Not_FoundInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`그 기록이 없어요. 목록을 새로 불러왔습니다.`)
};

/**
* | output |
* | --- |
* | "That record is gone. The list has been refreshed." |
*
* @param {Error_Achievement_Not_FoundInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const error_achievement_not_found = /** @type {((inputs?: Error_Achievement_Not_FoundInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Error_Achievement_Not_FoundInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_error_achievement_not_found(inputs)
	return ko_error_achievement_not_found(inputs)
});