/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Admin_Ai_Key_PlaceholderInputs */

const en_admin_ai_key_placeholder = /** @type {(inputs: Admin_Ai_Key_PlaceholderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`New key (leave blank to keep current)`)
};

const ko_admin_ai_key_placeholder = /** @type {(inputs: Admin_Ai_Key_PlaceholderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`새 키 입력(비우면 기존 키 유지)`)
};

/**
* | output |
* | --- |
* | "New key (leave blank to keep current)" |
*
* @param {Admin_Ai_Key_PlaceholderInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const admin_ai_key_placeholder = /** @type {((inputs?: Admin_Ai_Key_PlaceholderInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Admin_Ai_Key_PlaceholderInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_admin_ai_key_placeholder(inputs)
	return ko_admin_ai_key_placeholder(inputs)
});