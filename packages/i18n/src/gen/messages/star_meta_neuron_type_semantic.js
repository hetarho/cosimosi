/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Star_Meta_Neuron_Type_SemanticInputs */

const en_star_meta_neuron_type_semantic = /** @type {(inputs: Star_Meta_Neuron_Type_SemanticInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Meaning`)
};

const ko_star_meta_neuron_type_semantic = /** @type {(inputs: Star_Meta_Neuron_Type_SemanticInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`의미`)
};

/**
* | output |
* | --- |
* | "Meaning" |
*
* @param {Star_Meta_Neuron_Type_SemanticInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const star_meta_neuron_type_semantic = /** @type {((inputs?: Star_Meta_Neuron_Type_SemanticInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Star_Meta_Neuron_Type_SemanticInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_star_meta_neuron_type_semantic(inputs)
	return ko_star_meta_neuron_type_semantic(inputs)
});