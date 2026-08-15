/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Store_Ornament_Mote_Field_SparseInputs */

const en_store_ornament_mote_field_sparse = /** @type {(inputs: Store_Ornament_Mote_Field_SparseInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Sparse`)
};

const ko_store_ornament_mote_field_sparse = /** @type {(inputs: Store_Ornament_Mote_Field_SparseInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`듬성듬성`)
};

/**
* | output |
* | --- |
* | "Sparse" |
*
* @param {Store_Ornament_Mote_Field_SparseInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const store_ornament_mote_field_sparse = /** @type {((inputs?: Store_Ornament_Mote_Field_SparseInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Store_Ornament_Mote_Field_SparseInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_store_ornament_mote_field_sparse(inputs)
	return ko_store_ornament_mote_field_sparse(inputs)
});