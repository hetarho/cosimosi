/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Deletion_Delete_Affected_EmptyInputs */

const en_deletion_delete_affected_empty = /** @type {(inputs: Deletion_Delete_Affected_EmptyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`No stars remain right now.`)
};

const ko_deletion_delete_affected_empty = /** @type {(inputs: Deletion_Delete_Affected_EmptyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`지금 남아 있는 별이 없어요.`)
};

/**
* | output |
* | --- |
* | "No stars remain right now." |
*
* @param {Deletion_Delete_Affected_EmptyInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const deletion_delete_affected_empty = /** @type {((inputs?: Deletion_Delete_Affected_EmptyInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Deletion_Delete_Affected_EmptyInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_deletion_delete_affected_empty(inputs)
	return ko_deletion_delete_affected_empty(inputs)
});