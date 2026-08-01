/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Landing_Play_NoteInputs */

const en_landing_play_note = /** @type {(inputs: Landing_Play_NoteInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`This star floats only on this page. Nothing is saved.`)
};

const ko_landing_play_note = /** @type {(inputs: Landing_Play_NoteInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`이 별은 이 페이지에만 잠시 떠 있습니다. 아무것도 저장되지 않아요.`)
};

/**
* | output |
* | --- |
* | "This star floats only on this page. Nothing is saved." |
*
* @param {Landing_Play_NoteInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const landing_play_note = /** @type {((inputs?: Landing_Play_NoteInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Landing_Play_NoteInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_landing_play_note(inputs)
	return ko_landing_play_note(inputs)
});