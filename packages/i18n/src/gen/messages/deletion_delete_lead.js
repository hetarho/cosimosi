/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Deletion_Delete_LeadInputs */

const en_deletion_delete_lead = /** @type {(inputs: Deletion_Delete_LeadInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`This removes every star born from this diary.`)
};

const ko_deletion_delete_lead = /** @type {(inputs: Deletion_Delete_LeadInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`이 일기에서 태어난 별을 모두 지워요.`)
};

/**
* | output |
* | --- |
* | "This removes every star born from this diary." |
*
* @param {Deletion_Delete_LeadInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const deletion_delete_lead = /** @type {((inputs?: Deletion_Delete_LeadInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Deletion_Delete_LeadInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_deletion_delete_lead(inputs)
	return ko_deletion_delete_lead(inputs)
});