/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Deletion_Letgo_Phrasing_NoteInputs */

const en_deletion_letgo_phrasing_note = /** @type {(inputs: Deletion_Letgo_Phrasing_NoteInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`This blurs a trace a little. It is not treatment.`)
};

const ko_deletion_letgo_phrasing_note = /** @type {(inputs: Deletion_Letgo_Phrasing_NoteInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`이건 흔적을 조금 흐리게 하는 일이에요. 치료가 아니에요.`)
};

/**
* | output |
* | --- |
* | "This blurs a trace a little. It is not treatment." |
*
* @param {Deletion_Letgo_Phrasing_NoteInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const deletion_letgo_phrasing_note = /** @type {((inputs?: Deletion_Letgo_Phrasing_NoteInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Deletion_Letgo_Phrasing_NoteInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_deletion_letgo_phrasing_note(inputs)
	return ko_deletion_letgo_phrasing_note(inputs)
});