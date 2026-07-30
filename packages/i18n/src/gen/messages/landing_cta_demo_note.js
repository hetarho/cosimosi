/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Landing_Cta_Demo_NoteInputs */

const en_landing_cta_demo_note = /** @type {(inputs: Landing_Cta_Demo_NoteInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`No account. Nothing saved.`)
};

const ko_landing_cta_demo_note = /** @type {(inputs: Landing_Cta_Demo_NoteInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`가입 없이. 아무것도 저장되지 않아요.`)
};

/**
* | output |
* | --- |
* | "No account. Nothing saved." |
*
* @param {Landing_Cta_Demo_NoteInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const landing_cta_demo_note = /** @type {((inputs?: Landing_Cta_Demo_NoteInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Landing_Cta_Demo_NoteInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_landing_cta_demo_note(inputs)
	return ko_landing_cta_demo_note(inputs)
});