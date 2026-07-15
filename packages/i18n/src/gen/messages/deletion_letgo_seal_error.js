/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Deletion_Letgo_Seal_ErrorInputs */

const en_deletion_letgo_seal_error = /** @type {(inputs: Deletion_Letgo_Seal_ErrorInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Could not let go just now. Nothing was blurred.`)
};

const ko_deletion_letgo_seal_error = /** @type {(inputs: Deletion_Letgo_Seal_ErrorInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`지금은 놓아주지 못했어요. 아무것도 흐려지지 않았어요.`)
};

/**
* | output |
* | --- |
* | "Could not let go just now. Nothing was blurred." |
*
* @param {Deletion_Letgo_Seal_ErrorInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const deletion_letgo_seal_error = /** @type {((inputs?: Deletion_Letgo_Seal_ErrorInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Deletion_Letgo_Seal_ErrorInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_deletion_letgo_seal_error(inputs)
	return ko_deletion_letgo_seal_error(inputs)
});