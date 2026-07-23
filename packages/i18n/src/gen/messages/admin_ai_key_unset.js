/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Admin_Ai_Key_UnsetInputs */

const en_admin_ai_key_unset = /** @type {(inputs: Admin_Ai_Key_UnsetInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`No key`)
};

const ko_admin_ai_key_unset = /** @type {(inputs: Admin_Ai_Key_UnsetInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`키 없음`)
};

/**
* | output |
* | --- |
* | "No key" |
*
* @param {Admin_Ai_Key_UnsetInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const admin_ai_key_unset = /** @type {((inputs?: Admin_Ai_Key_UnsetInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Admin_Ai_Key_UnsetInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_admin_ai_key_unset(inputs)
	return ko_admin_ai_key_unset(inputs)
});