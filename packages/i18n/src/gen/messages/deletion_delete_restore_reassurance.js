/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ days: NonNullable<unknown> }} Deletion_Delete_Restore_ReassuranceInputs */

const en_deletion_delete_restore_reassurance = /** @type {(inputs: Deletion_Delete_Restore_ReassuranceInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`You can undo this within ${i?.days} days.`)
};

const ko_deletion_delete_restore_reassurance = /** @type {(inputs: Deletion_Delete_Restore_ReassuranceInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.days}일 안에는 되돌릴 수 있어요.`)
};

/**
* | output |
* | --- |
* | "You can undo this within {days} days." |
*
* @param {Deletion_Delete_Restore_ReassuranceInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const deletion_delete_restore_reassurance = /** @type {((inputs: Deletion_Delete_Restore_ReassuranceInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Deletion_Delete_Restore_ReassuranceInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_deletion_delete_restore_reassurance(inputs)
	return ko_deletion_delete_restore_reassurance(inputs)
});