/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Star_Meta_Neuron_TypeInputs */

const en_star_meta_neuron_type = /** @type {(inputs: Star_Meta_Neuron_TypeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Type`)
};

const ko_star_meta_neuron_type = /** @type {(inputs: Star_Meta_Neuron_TypeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`유형`)
};

/**
* | output |
* | --- |
* | "Type" |
*
* @param {Star_Meta_Neuron_TypeInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const star_meta_neuron_type = /** @type {((inputs?: Star_Meta_Neuron_TypeInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Star_Meta_Neuron_TypeInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_star_meta_neuron_type(inputs)
	return ko_star_meta_neuron_type(inputs)
});