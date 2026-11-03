/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Memory_Restore_ConfirmInputs */

const en_memory_restore_confirm = /** @type {(inputs: Memory_Restore_ConfirmInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Restore stored words`)
};

const ko_memory_restore_confirm = /** @type {(inputs: Memory_Restore_ConfirmInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`원문 되살리기`)
};

/**
* | output |
* | --- |
* | "Restore stored words" |
*
* @param {Memory_Restore_ConfirmInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const memory_restore_confirm = /** @type {((inputs?: Memory_Restore_ConfirmInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Memory_Restore_ConfirmInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_memory_restore_confirm(inputs)
	return ko_memory_restore_confirm(inputs)
});