/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Withdraw_ConfirmInputs */

const en_withdraw_confirm = /** @type {(inputs: Withdraw_ConfirmInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Withdraw and sign out`)
};

const ko_withdraw_confirm = /** @type {(inputs: Withdraw_ConfirmInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`탈퇴하고 로그아웃`)
};

/**
* | output |
* | --- |
* | "Withdraw and sign out" |
*
* @param {Withdraw_ConfirmInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const withdraw_confirm = /** @type {((inputs?: Withdraw_ConfirmInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Withdraw_ConfirmInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_withdraw_confirm(inputs)
	return ko_withdraw_confirm(inputs)
});