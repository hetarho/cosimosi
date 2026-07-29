/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Store_Panel_TitleInputs */

const en_store_panel_title = /** @type {(inputs: Store_Panel_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Decorate your universe`)
};

const ko_store_panel_title = /** @type {(inputs: Store_Panel_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`우주 꾸미기`)
};

/**
* | output |
* | --- |
* | "Decorate your universe" |
*
* @param {Store_Panel_TitleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const store_panel_title = /** @type {((inputs?: Store_Panel_TitleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Store_Panel_TitleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_store_panel_title(inputs)
	return ko_store_panel_title(inputs)
});