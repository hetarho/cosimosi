/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Achievement_Shared_Neuron_5_BodyInputs */

const en_achievement_shared_neuron_5_body = /** @type {(inputs: Achievement_Shared_Neuron_5_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`It has become a place you keep returning to.`)
};

const ko_achievement_shared_neuron_5_body = /** @type {(inputs: Achievement_Shared_Neuron_5_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`계속 돌아가는 자리가 되었어요.`)
};

/**
* | output |
* | --- |
* | "It has become a place you keep returning to." |
*
* @param {Achievement_Shared_Neuron_5_BodyInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const achievement_shared_neuron_5_body = /** @type {((inputs?: Achievement_Shared_Neuron_5_BodyInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Achievement_Shared_Neuron_5_BodyInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_achievement_shared_neuron_5_body(inputs)
	return ko_achievement_shared_neuron_5_body(inputs)
});