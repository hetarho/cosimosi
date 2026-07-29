/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Achievement_Axis_Neuron_SharingInputs */

const en_achievement_axis_neuron_sharing = /** @type {(inputs: Achievement_Axis_Neuron_SharingInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Shared threads`)
};

const ko_achievement_axis_neuron_sharing = /** @type {(inputs: Achievement_Axis_Neuron_SharingInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`이어진 실`)
};

/**
* | output |
* | --- |
* | "Shared threads" |
*
* @param {Achievement_Axis_Neuron_SharingInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const achievement_axis_neuron_sharing = /** @type {((inputs?: Achievement_Axis_Neuron_SharingInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Achievement_Axis_Neuron_SharingInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_achievement_axis_neuron_sharing(inputs)
	return ko_achievement_axis_neuron_sharing(inputs)
});