/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Withdraw_TitleInputs */

const en_withdraw_title = /** @type {(inputs: Withdraw_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Leave this account`)
};

const ko_withdraw_title = /** @type {(inputs: Withdraw_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`이 계정을 떠나기`)
};

/**
* | output |
* | --- |
* | "Leave this account" |
*
* @param {Withdraw_TitleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const withdraw_title = /** @type {((inputs?: Withdraw_TitleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Withdraw_TitleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_withdraw_title(inputs)
	return ko_withdraw_title(inputs)
});