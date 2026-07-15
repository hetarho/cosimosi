/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Deletion_Restore_ActionInputs */

const en_deletion_restore_action = /** @type {(inputs: Deletion_Restore_ActionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Undo`)
};

const ko_deletion_restore_action = /** @type {(inputs: Deletion_Restore_ActionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`되돌리기`)
};

/**
* | output |
* | --- |
* | "Undo" |
*
* @param {Deletion_Restore_ActionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const deletion_restore_action = /** @type {((inputs?: Deletion_Restore_ActionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Deletion_Restore_ActionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_deletion_restore_action(inputs)
	return ko_deletion_restore_action(inputs)
});