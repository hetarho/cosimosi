/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Deletion_Letgo_Suggest_ErrorInputs */

const en_deletion_letgo_suggest_error = /** @type {(inputs: Deletion_Letgo_Suggest_ErrorInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Could not find it just now. Try again in a moment.`)
};

const ko_deletion_letgo_suggest_error = /** @type {(inputs: Deletion_Letgo_Suggest_ErrorInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`지금은 찾지 못했어요. 잠시 뒤 다시 시도해요.`)
};

/**
* | output |
* | --- |
* | "Could not find it just now. Try again in a moment." |
*
* @param {Deletion_Letgo_Suggest_ErrorInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const deletion_letgo_suggest_error = /** @type {((inputs?: Deletion_Letgo_Suggest_ErrorInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Deletion_Letgo_Suggest_ErrorInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_deletion_letgo_suggest_error(inputs)
	return ko_deletion_letgo_suggest_error(inputs)
});