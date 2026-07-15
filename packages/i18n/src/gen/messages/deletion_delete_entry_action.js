/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Deletion_Delete_Entry_ActionInputs */

const en_deletion_delete_entry_action = /** @type {(inputs: Deletion_Delete_Entry_ActionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Delete this diary`)
};

const ko_deletion_delete_entry_action = /** @type {(inputs: Deletion_Delete_Entry_ActionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`이 일기 지우기`)
};

/**
* | output |
* | --- |
* | "Delete this diary" |
*
* @param {Deletion_Delete_Entry_ActionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const deletion_delete_entry_action = /** @type {((inputs?: Deletion_Delete_Entry_ActionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Deletion_Delete_Entry_ActionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_deletion_delete_entry_action(inputs)
	return ko_deletion_delete_entry_action(inputs)
});