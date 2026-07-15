/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Diary_Reader_JumpingInputs */

const en_diary_reader_jumping = /** @type {(inputs: Diary_Reader_JumpingInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Bringing these stars back to mind…`)
};

const ko_diary_reader_jumping = /** @type {(inputs: Diary_Reader_JumpingInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`별들을 다시 떠올리는 중…`)
};

/**
* | output |
* | --- |
* | "Bringing these stars back to mind…" |
*
* @param {Diary_Reader_JumpingInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const diary_reader_jumping = /** @type {((inputs?: Diary_Reader_JumpingInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Diary_Reader_JumpingInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_diary_reader_jumping(inputs)
	return ko_diary_reader_jumping(inputs)
});