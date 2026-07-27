/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Me_Stardust_Refill_NoteInputs */

const en_me_stardust_refill_note = /** @type {(inputs: Me_Stardust_Refill_NoteInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`It fills every day, so it leaves no record.`)
};

const ko_me_stardust_refill_note = /** @type {(inputs: Me_Stardust_Refill_NoteInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`매일 채워지는 몫이라 내역에 남지 않아요.`)
};

/**
* | output |
* | --- |
* | "It fills every day, so it leaves no record." |
*
* @param {Me_Stardust_Refill_NoteInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const me_stardust_refill_note = /** @type {((inputs?: Me_Stardust_Refill_NoteInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Me_Stardust_Refill_NoteInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_me_stardust_refill_note(inputs)
	return ko_me_stardust_refill_note(inputs)
});