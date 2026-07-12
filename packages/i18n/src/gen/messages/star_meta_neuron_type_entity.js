/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Star_Meta_Neuron_Type_EntityInputs */

const en_star_meta_neuron_type_entity = /** @type {(inputs: Star_Meta_Neuron_Type_EntityInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Entity`)
};

const ko_star_meta_neuron_type_entity = /** @type {(inputs: Star_Meta_Neuron_Type_EntityInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`개체`)
};

/**
* | output |
* | --- |
* | "Entity" |
*
* @param {Star_Meta_Neuron_Type_EntityInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const star_meta_neuron_type_entity = /** @type {((inputs?: Star_Meta_Neuron_Type_EntityInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Star_Meta_Neuron_Type_EntityInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_star_meta_neuron_type_entity(inputs)
	return ko_star_meta_neuron_type_entity(inputs)
});