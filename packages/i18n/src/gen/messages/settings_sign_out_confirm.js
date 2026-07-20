/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Settings_Sign_Out_ConfirmInputs */

const en_settings_sign_out_confirm = /** @type {(inputs: Settings_Sign_Out_ConfirmInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Sign out now?`)
};

const ko_settings_sign_out_confirm = /** @type {(inputs: Settings_Sign_Out_ConfirmInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`정말 로그아웃할까요?`)
};

/**
* | output |
* | --- |
* | "Sign out now?" |
*
* @param {Settings_Sign_Out_ConfirmInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const settings_sign_out_confirm = /** @type {((inputs?: Settings_Sign_Out_ConfirmInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Settings_Sign_Out_ConfirmInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_settings_sign_out_confirm(inputs)
	return ko_settings_sign_out_confirm(inputs)
});