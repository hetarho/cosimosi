/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Error_ConflictInputs */

const en_error_conflict = /** @type {(inputs: Error_ConflictInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`That action conflicts with a recent change. Try again.`)
};

const ko_error_conflict = /** @type {(inputs: Error_ConflictInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`최근 변경과 충돌했어요. 다시 시도해요.`)
};

/**
* | output |
* | --- |
* | "That action conflicts with a recent change. Try again." |
*
* @param {Error_ConflictInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const error_conflict = /** @type {((inputs?: Error_ConflictInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Error_ConflictInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_error_conflict(inputs)
	return ko_error_conflict(inputs)
});