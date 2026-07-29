/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Store_Save_ActionInputs */

const en_store_save_action = /** @type {(inputs: Store_Save_ActionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Save`)
};

const ko_store_save_action = /** @type {(inputs: Store_Save_ActionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`저장`)
};

/**
* | output |
* | --- |
* | "Save" |
*
* @param {Store_Save_ActionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const store_save_action = /** @type {((inputs?: Store_Save_ActionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Store_Save_ActionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_store_save_action(inputs)
	return ko_store_save_action(inputs)
});