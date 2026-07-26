/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Withdraw_StartInputs */

const en_withdraw_start = /** @type {(inputs: Withdraw_StartInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Withdraw account`)
};

const ko_withdraw_start = /** @type {(inputs: Withdraw_StartInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`계정 탈퇴`)
};

/**
* | output |
* | --- |
* | "Withdraw account" |
*
* @param {Withdraw_StartInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const withdraw_start = /** @type {((inputs?: Withdraw_StartInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Withdraw_StartInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_withdraw_start(inputs)
	return ko_withdraw_start(inputs)
});