/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Deletion_Restore_Section_TitleInputs */

const en_deletion_restore_section_title = /** @type {(inputs: Deletion_Restore_Section_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Deleted diaries`)
};

const ko_deletion_restore_section_title = /** @type {(inputs: Deletion_Restore_Section_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`지운 일기`)
};

/**
* | output |
* | --- |
* | "Deleted diaries" |
*
* @param {Deletion_Restore_Section_TitleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const deletion_restore_section_title = /** @type {((inputs?: Deletion_Restore_Section_TitleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Deletion_Restore_Section_TitleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_deletion_restore_section_title(inputs)
	return ko_deletion_restore_section_title(inputs)
});