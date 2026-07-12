/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Star_Meta_Neuron_ConnectivityInputs */

const en_star_meta_neuron_connectivity = /** @type {(inputs: Star_Meta_Neuron_ConnectivityInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Connections`)
};

const ko_star_meta_neuron_connectivity = /** @type {(inputs: Star_Meta_Neuron_ConnectivityInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`연결`)
};

/**
* | output |
* | --- |
* | "Connections" |
*
* @param {Star_Meta_Neuron_ConnectivityInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const star_meta_neuron_connectivity = /** @type {((inputs?: Star_Meta_Neuron_ConnectivityInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Star_Meta_Neuron_ConnectivityInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_star_meta_neuron_connectivity(inputs)
	return ko_star_meta_neuron_connectivity(inputs)
});