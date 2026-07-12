/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Star_Meta_Neuron_UnnamedInputs */

const en_star_meta_neuron_unnamed = /** @type {(inputs: Star_Meta_Neuron_UnnamedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Unnamed`)
};

const ko_star_meta_neuron_unnamed = /** @type {(inputs: Star_Meta_Neuron_UnnamedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`이름 없음`)
};

/**
* | output |
* | --- |
* | "Unnamed" |
*
* @param {Star_Meta_Neuron_UnnamedInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const star_meta_neuron_unnamed = /** @type {((inputs?: Star_Meta_Neuron_UnnamedInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Star_Meta_Neuron_UnnamedInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_star_meta_neuron_unnamed(inputs)
	return ko_star_meta_neuron_unnamed(inputs)
});