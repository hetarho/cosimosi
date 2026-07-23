/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Admin_Users_Grant_NoteInputs */

const en_admin_users_grant_note = /** @type {(inputs: Admin_Users_Grant_NoteInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Note (optional)`)
};

const ko_admin_users_grant_note = /** @type {(inputs: Admin_Users_Grant_NoteInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`메모(선택)`)
};

/**
* | output |
* | --- |
* | "Note (optional)" |
*
* @param {Admin_Users_Grant_NoteInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const admin_users_grant_note = /** @type {((inputs?: Admin_Users_Grant_NoteInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Admin_Users_Grant_NoteInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_admin_users_grant_note(inputs)
	return ko_admin_users_grant_note(inputs)
});