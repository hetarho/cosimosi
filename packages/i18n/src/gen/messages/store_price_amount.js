/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ amount: NonNullable<unknown> }} Store_Price_AmountInputs */

const en_store_price_amount = /** @type {(inputs: Store_Price_AmountInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.amount} stardust`)
};

const ko_store_price_amount = /** @type {(inputs: Store_Price_AmountInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`별가루 ${i?.amount}`)
};

/**
* | output |
* | --- |
* | "{amount} stardust" |
*
* @param {Store_Price_AmountInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const store_price_amount = /** @type {((inputs: Store_Price_AmountInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Store_Price_AmountInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_store_price_amount(inputs)
	return ko_store_price_amount(inputs)
});