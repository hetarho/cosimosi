/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Achievement_Shared_Neuron_5_TitleInputs */

const en_achievement_shared_neuron_5_title = /** @type {(inputs: Achievement_Shared_Neuron_5_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Five around one thread`)
};

const ko_achievement_shared_neuron_5_title = /** @type {(inputs: Achievement_Shared_Neuron_5_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`한 실에 다섯`)
};

/**
* | output |
* | --- |
* | "Five around one thread" |
*
* @param {Achievement_Shared_Neuron_5_TitleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const achievement_shared_neuron_5_title = /** @type {((inputs?: Achievement_Shared_Neuron_5_TitleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Achievement_Shared_Neuron_5_TitleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_achievement_shared_neuron_5_title(inputs)
	return ko_achievement_shared_neuron_5_title(inputs)
});