/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ amount: NonNullable<unknown> }} Store_Save_Action_PricedInputs */

const en_store_save_action_priced = /** @type {(inputs: Store_Save_Action_PricedInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`Save · ${i?.amount} stardust`)
};

const ko_store_save_action_priced = /** @type {(inputs: Store_Save_Action_PricedInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`저장 · 별가루 ${i?.amount}`)
};

/**
* | output |
* | --- |
* | "Save · {amount} stardust" |
*
* @param {Store_Save_Action_PricedInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const store_save_action_priced = /** @type {((inputs: Store_Save_Action_PricedInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Store_Save_Action_PricedInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_store_save_action_priced(inputs)
	return ko_store_save_action_priced(inputs)
});