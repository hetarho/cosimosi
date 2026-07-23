/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Admin_Ai_Key_SetInputs */

const en_admin_ai_key_set = /** @type {(inputs: Admin_Ai_Key_SetInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Key set`)
};

const ko_admin_ai_key_set = /** @type {(inputs: Admin_Ai_Key_SetInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`키 설정됨`)
};

/**
* | output |
* | --- |
* | "Key set" |
*
* @param {Admin_Ai_Key_SetInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const admin_ai_key_set = /** @type {((inputs?: Admin_Ai_Key_SetInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Admin_Ai_Key_SetInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_admin_ai_key_set(inputs)
	return ko_admin_ai_key_set(inputs)
});