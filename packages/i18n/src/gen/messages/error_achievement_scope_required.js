/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Error_Achievement_Scope_RequiredInputs */

const en_error_achievement_scope_required = /** @type {(inputs: Error_Achievement_Scope_RequiredInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Sign in to see your records.`)
};

const ko_error_achievement_scope_required = /** @type {(inputs: Error_Achievement_Scope_RequiredInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`기록을 보려면 로그인해 주세요.`)
};

/**
* | output |
* | --- |
* | "Sign in to see your records." |
*
* @param {Error_Achievement_Scope_RequiredInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const error_achievement_scope_required = /** @type {((inputs?: Error_Achievement_Scope_RequiredInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Error_Achievement_Scope_RequiredInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_error_achievement_scope_required(inputs)
	return ko_error_achievement_scope_required(inputs)
});