/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Deletion_Delete_Affected_LabelInputs */

const en_deletion_delete_affected_label = /** @type {(inputs: Deletion_Delete_Affected_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Stars to be removed`)
};

const ko_deletion_delete_affected_label = /** @type {(inputs: Deletion_Delete_Affected_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`지워질 별`)
};

/**
* | output |
* | --- |
* | "Stars to be removed" |
*
* @param {Deletion_Delete_Affected_LabelInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const deletion_delete_affected_label = /** @type {((inputs?: Deletion_Delete_Affected_LabelInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Deletion_Delete_Affected_LabelInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_deletion_delete_affected_label(inputs)
	return ko_deletion_delete_affected_label(inputs)
});