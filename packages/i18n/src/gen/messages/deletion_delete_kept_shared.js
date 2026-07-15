/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Deletion_Delete_Kept_SharedInputs */

const en_deletion_delete_kept_shared = /** @type {(inputs: Deletion_Delete_Kept_SharedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Meaning shared with other diaries stays.`)
};

const ko_deletion_delete_kept_shared = /** @type {(inputs: Deletion_Delete_Kept_SharedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`여러 일기가 함께 쓰는 의미는 남아요.`)
};

/**
* | output |
* | --- |
* | "Meaning shared with other diaries stays." |
*
* @param {Deletion_Delete_Kept_SharedInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const deletion_delete_kept_shared = /** @type {((inputs?: Deletion_Delete_Kept_SharedInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Deletion_Delete_Kept_SharedInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_deletion_delete_kept_shared(inputs)
	return ko_deletion_delete_kept_shared(inputs)
});