/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Deletion_DeletingInputs */

const en_deletion_deleting = /** @type {(inputs: Deletion_DeletingInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Deleting…`)
};

const ko_deletion_deleting = /** @type {(inputs: Deletion_DeletingInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`지우는 중…`)
};

/**
* | output |
* | --- |
* | "Deleting…" |
*
* @param {Deletion_DeletingInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const deletion_deleting = /** @type {((inputs?: Deletion_DeletingInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Deletion_DeletingInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_deletion_deleting(inputs)
	return ko_deletion_deleting(inputs)
});