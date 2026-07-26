/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Withdraw_Export_OfferInputs */

const en_withdraw_export_offer = /** @type {(inputs: Withdraw_Export_OfferInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Would you like to export your diaries as CSV or Markdown now?`)
};

const ko_withdraw_export_offer = /** @type {(inputs: Withdraw_Export_OfferInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`지금 CSV나 Markdown으로 일기를 내보내시겠어요?`)
};

/**
* | output |
* | --- |
* | "Would you like to export your diaries as CSV or Markdown now?" |
*
* @param {Withdraw_Export_OfferInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const withdraw_export_offer = /** @type {((inputs?: Withdraw_Export_OfferInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Withdraw_Export_OfferInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_withdraw_export_offer(inputs)
	return ko_withdraw_export_offer(inputs)
});