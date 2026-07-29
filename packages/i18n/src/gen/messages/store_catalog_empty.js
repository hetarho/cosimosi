/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Store_Catalog_EmptyInputs */

const en_store_catalog_empty = /** @type {(inputs: Store_Catalog_EmptyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`There is nothing to choose yet.`)
};

const ko_store_catalog_empty = /** @type {(inputs: Store_Catalog_EmptyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`고를 수 있는 게 아직 없어요.`)
};

/**
* | output |
* | --- |
* | "There is nothing to choose yet." |
*
* @param {Store_Catalog_EmptyInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const store_catalog_empty = /** @type {((inputs?: Store_Catalog_EmptyInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Store_Catalog_EmptyInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_store_catalog_empty(inputs)
	return ko_store_catalog_empty(inputs)
});