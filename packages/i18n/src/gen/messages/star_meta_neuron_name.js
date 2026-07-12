/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Star_Meta_Neuron_NameInputs */

const en_star_meta_neuron_name = /** @type {(inputs: Star_Meta_Neuron_NameInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Name`)
};

const ko_star_meta_neuron_name = /** @type {(inputs: Star_Meta_Neuron_NameInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`이름`)
};

/**
* | output |
* | --- |
* | "Name" |
*
* @param {Star_Meta_Neuron_NameInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const star_meta_neuron_name = /** @type {((inputs?: Star_Meta_Neuron_NameInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Star_Meta_Neuron_NameInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_star_meta_neuron_name(inputs)
	return ko_star_meta_neuron_name(inputs)
});