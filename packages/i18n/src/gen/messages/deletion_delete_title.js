/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Deletion_Delete_TitleInputs */

const en_deletion_delete_title = /** @type {(inputs: Deletion_Delete_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Delete this diary?`)
};

const ko_deletion_delete_title = /** @type {(inputs: Deletion_Delete_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`이 일기를 지울까요`)
};

/**
* | output |
* | --- |
* | "Delete this diary?" |
*
* @param {Deletion_Delete_TitleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const deletion_delete_title = /** @type {((inputs?: Deletion_Delete_TitleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Deletion_Delete_TitleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_deletion_delete_title(inputs)
	return ko_deletion_delete_title(inputs)
});