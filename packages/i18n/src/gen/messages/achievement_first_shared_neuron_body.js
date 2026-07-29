/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Achievement_First_Shared_Neuron_BodyInputs */

const en_achievement_first_shared_neuron_body = /** @type {(inputs: Achievement_First_Shared_Neuron_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Two memories turned out to be made of the same thing.`)
};

const ko_achievement_first_shared_neuron_body = /** @type {(inputs: Achievement_First_Shared_Neuron_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`두 기억이 같은 것으로 이루어져 있었어요.`)
};

/**
* | output |
* | --- |
* | "Two memories turned out to be made of the same thing." |
*
* @param {Achievement_First_Shared_Neuron_BodyInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const achievement_first_shared_neuron_body = /** @type {((inputs?: Achievement_First_Shared_Neuron_BodyInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Achievement_First_Shared_Neuron_BodyInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_achievement_first_shared_neuron_body(inputs)
	return ko_achievement_first_shared_neuron_body(inputs)
});