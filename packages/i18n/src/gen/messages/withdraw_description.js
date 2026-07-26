/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ days: NonNullable<unknown> }} Withdraw_DescriptionInputs */

const en_withdraw_description = /** @type {(inputs: Withdraw_DescriptionInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`Your account is held for ${i?.days} days before it is permanently removed.`)
};

const ko_withdraw_description = /** @type {(inputs: Withdraw_DescriptionInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`계정은 ${i?.days}일 동안 보관된 뒤 완전히 정리돼요.`)
};

/**
* | output |
* | --- |
* | "Your account is held for {days} days before it is permanently removed." |
*
* @param {Withdraw_DescriptionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const withdraw_description = /** @type {((inputs: Withdraw_DescriptionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Withdraw_DescriptionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_withdraw_description(inputs)
	return ko_withdraw_description(inputs)
});