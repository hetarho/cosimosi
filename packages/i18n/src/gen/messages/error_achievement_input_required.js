/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Error_Achievement_Input_RequiredInputs */

const en_error_achievement_input_required = /** @type {(inputs: Error_Achievement_Input_RequiredInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Pick a record first.`)
};

const ko_error_achievement_input_required = /** @type {(inputs: Error_Achievement_Input_RequiredInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`먼저 기록을 하나 고르세요.`)
};

/**
* | output |
* | --- |
* | "Pick a record first." |
*
* @param {Error_Achievement_Input_RequiredInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const error_achievement_input_required = /** @type {((inputs?: Error_Achievement_Input_RequiredInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Error_Achievement_Input_RequiredInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_error_achievement_input_required(inputs)
	return ko_error_achievement_input_required(inputs)
});