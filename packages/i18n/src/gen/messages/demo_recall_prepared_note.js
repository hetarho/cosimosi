/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Demo_Recall_Prepared_NoteInputs */

const en_demo_recall_prepared_note = /** @type {(inputs: Demo_Recall_Prepared_NoteInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`In this demo the words you'd write back are already prepared.`)
};

const ko_demo_recall_prepared_note = /** @type {(inputs: Demo_Recall_Prepared_NoteInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`이 데모에서는 다시 적을 문장이 미리 준비돼 있어요.`)
};

/**
* | output |
* | --- |
* | "In this demo the words you'd write back are already prepared." |
*
* @param {Demo_Recall_Prepared_NoteInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const demo_recall_prepared_note = /** @type {((inputs?: Demo_Recall_Prepared_NoteInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Demo_Recall_Prepared_NoteInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_demo_recall_prepared_note(inputs)
	return ko_demo_recall_prepared_note(inputs)
});