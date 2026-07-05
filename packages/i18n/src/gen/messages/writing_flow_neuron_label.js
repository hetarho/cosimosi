/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Writing_Flow_Neuron_LabelInputs */

const en_writing_flow_neuron_label = /** @type {(inputs: Writing_Flow_Neuron_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Neurons`)
};

const ko_writing_flow_neuron_label = /** @type {(inputs: Writing_Flow_Neuron_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`뉴런`)
};

/**
* | output |
* | --- |
* | "Neurons" |
*
* @param {Writing_Flow_Neuron_LabelInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const writing_flow_neuron_label = /** @type {((inputs?: Writing_Flow_Neuron_LabelInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Writing_Flow_Neuron_LabelInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_writing_flow_neuron_label(inputs)
	return ko_writing_flow_neuron_label(inputs)
});