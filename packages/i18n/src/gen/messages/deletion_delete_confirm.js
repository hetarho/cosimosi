/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Deletion_Delete_ConfirmInputs */

const en_deletion_delete_confirm = /** @type {(inputs: Deletion_Delete_ConfirmInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Delete`)
};

const ko_deletion_delete_confirm = /** @type {(inputs: Deletion_Delete_ConfirmInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`지우기`)
};

/**
* | output |
* | --- |
* | "Delete" |
*
* @param {Deletion_Delete_ConfirmInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const deletion_delete_confirm = /** @type {((inputs?: Deletion_Delete_ConfirmInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Deletion_Delete_ConfirmInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_deletion_delete_confirm(inputs)
	return ko_deletion_delete_confirm(inputs)
});