/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Store_Panel_CloseInputs */

const en_store_panel_close = /** @type {(inputs: Store_Panel_CloseInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Close`)
};

const ko_store_panel_close = /** @type {(inputs: Store_Panel_CloseInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`닫기`)
};

/**
* | output |
* | --- |
* | "Close" |
*
* @param {Store_Panel_CloseInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const store_panel_close = /** @type {((inputs?: Store_Panel_CloseInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Store_Panel_CloseInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_store_panel_close(inputs)
	return ko_store_panel_close(inputs)
});