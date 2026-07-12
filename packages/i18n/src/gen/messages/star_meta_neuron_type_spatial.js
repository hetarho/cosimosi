/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Star_Meta_Neuron_Type_SpatialInputs */

const en_star_meta_neuron_type_spatial = /** @type {(inputs: Star_Meta_Neuron_Type_SpatialInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Place`)
};

const ko_star_meta_neuron_type_spatial = /** @type {(inputs: Star_Meta_Neuron_Type_SpatialInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`공간`)
};

/**
* | output |
* | --- |
* | "Place" |
*
* @param {Star_Meta_Neuron_Type_SpatialInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const star_meta_neuron_type_spatial = /** @type {((inputs?: Star_Meta_Neuron_Type_SpatialInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Star_Meta_Neuron_Type_SpatialInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_star_meta_neuron_type_spatial(inputs)
	return ko_star_meta_neuron_type_spatial(inputs)
});