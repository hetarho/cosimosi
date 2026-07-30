/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Demo_Theory_NoteInputs */

const en_demo_theory_note = /** @type {(inputs: Demo_Theory_NoteInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Inspired by engram theory. What you see is a way of looking, not the brain's own coordinates.`)
};

const ko_demo_theory_note = /** @type {(inputs: Demo_Theory_NoteInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`엔그램 이론에서 영감을 받았습니다. 여기 보이는 것은 보는 방식일 뿐, 뇌의 좌표가 아닙니다.`)
};

/**
* | output |
* | --- |
* | "Inspired by engram theory. What you see is a way of looking, not the brain's own coordinates." |
*
* @param {Demo_Theory_NoteInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const demo_theory_note = /** @type {((inputs?: Demo_Theory_NoteInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Demo_Theory_NoteInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_demo_theory_note(inputs)
	return ko_demo_theory_note(inputs)
});