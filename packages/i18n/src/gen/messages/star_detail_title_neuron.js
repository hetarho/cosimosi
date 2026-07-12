/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Star_Detail_Title_NeuronInputs */

const en_star_detail_title_neuron = /** @type {(inputs: Star_Detail_Title_NeuronInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Neuron`)
};

const ko_star_detail_title_neuron = /** @type {(inputs: Star_Detail_Title_NeuronInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`뉴런`)
};

/**
* | output |
* | --- |
* | "Neuron" |
*
* @param {Star_Detail_Title_NeuronInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const star_detail_title_neuron = /** @type {((inputs?: Star_Detail_Title_NeuronInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Star_Detail_Title_NeuronInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_star_detail_title_neuron(inputs)
	return ko_star_detail_title_neuron(inputs)
});