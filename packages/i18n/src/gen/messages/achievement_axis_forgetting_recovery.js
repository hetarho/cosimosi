/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Achievement_Axis_Forgetting_RecoveryInputs */

const en_achievement_axis_forgetting_recovery = /** @type {(inputs: Achievement_Axis_Forgetting_RecoveryInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Brought back`)
};

const ko_achievement_axis_forgetting_recovery = /** @type {(inputs: Achievement_Axis_Forgetting_RecoveryInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`되찾은 기억`)
};

/**
* | output |
* | --- |
* | "Brought back" |
*
* @param {Achievement_Axis_Forgetting_RecoveryInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const achievement_axis_forgetting_recovery = /** @type {((inputs?: Achievement_Axis_Forgetting_RecoveryInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Achievement_Axis_Forgetting_RecoveryInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_achievement_axis_forgetting_recovery(inputs)
	return ko_achievement_axis_forgetting_recovery(inputs)
});