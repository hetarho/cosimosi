/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Achievement_First_Shared_Neuron_TitleInputs */

const en_achievement_first_shared_neuron_title = /** @type {(inputs: Achievement_First_Shared_Neuron_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`The first shared thread`)
};

const ko_achievement_first_shared_neuron_title = /** @type {(inputs: Achievement_First_Shared_Neuron_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`처음 겹친 실`)
};

/**
* | output |
* | --- |
* | "The first shared thread" |
*
* @param {Achievement_First_Shared_Neuron_TitleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const achievement_first_shared_neuron_title = /** @type {((inputs?: Achievement_First_Shared_Neuron_TitleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Achievement_First_Shared_Neuron_TitleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_achievement_first_shared_neuron_title(inputs)
	return ko_achievement_first_shared_neuron_title(inputs)
});