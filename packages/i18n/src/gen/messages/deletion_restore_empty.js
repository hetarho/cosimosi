/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Deletion_Restore_EmptyInputs */

const en_deletion_restore_empty = /** @type {(inputs: Deletion_Restore_EmptyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Nothing is left to restore.`)
};

const ko_deletion_restore_empty = /** @type {(inputs: Deletion_Restore_EmptyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`되돌릴 일기가 남아 있지 않아요.`)
};

/**
* | output |
* | --- |
* | "Nothing is left to restore." |
*
* @param {Deletion_Restore_EmptyInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const deletion_restore_empty = /** @type {((inputs?: Deletion_Restore_EmptyInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Deletion_Restore_EmptyInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_deletion_restore_empty(inputs)
	return ko_deletion_restore_empty(inputs)
});