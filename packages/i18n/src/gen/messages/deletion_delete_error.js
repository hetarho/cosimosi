/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Deletion_Delete_ErrorInputs */

const en_deletion_delete_error = /** @type {(inputs: Deletion_Delete_ErrorInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Could not delete just now. Try again in a moment.`)
};

const ko_deletion_delete_error = /** @type {(inputs: Deletion_Delete_ErrorInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`지금은 지우지 못했어요. 잠시 뒤 다시 시도해요.`)
};

/**
* | output |
* | --- |
* | "Could not delete just now. Try again in a moment." |
*
* @param {Deletion_Delete_ErrorInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const deletion_delete_error = /** @type {((inputs?: Deletion_Delete_ErrorInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Deletion_Delete_ErrorInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_deletion_delete_error(inputs)
	return ko_deletion_delete_error(inputs)
});