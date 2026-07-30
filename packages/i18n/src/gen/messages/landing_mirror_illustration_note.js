/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Landing_Mirror_Illustration_NoteInputs */

const en_landing_mirror_illustration_note = /** @type {(inputs: Landing_Mirror_Illustration_NoteInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`An illustration with invented entries, not anyone's data.`)
};

const ko_landing_mirror_illustration_note = /** @type {(inputs: Landing_Mirror_Illustration_NoteInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`지어낸 기록으로 만든 예시입니다. 누군가의 데이터가 아닙니다.`)
};

/**
* | output |
* | --- |
* | "An illustration with invented entries, not anyone's data." |
*
* @param {Landing_Mirror_Illustration_NoteInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const landing_mirror_illustration_note = /** @type {((inputs?: Landing_Mirror_Illustration_NoteInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Landing_Mirror_Illustration_NoteInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_landing_mirror_illustration_note(inputs)
	return ko_landing_mirror_illustration_note(inputs)
});