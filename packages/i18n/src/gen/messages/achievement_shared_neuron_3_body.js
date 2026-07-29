/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Achievement_Shared_Neuron_3_BodyInputs */

const en_achievement_shared_neuron_3_body = /** @type {(inputs: Achievement_Shared_Neuron_3_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`One thing keeps turning up in what you write.`)
};

const ko_achievement_shared_neuron_3_body = /** @type {(inputs: Achievement_Shared_Neuron_3_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`쓰는 글에 자꾸 나오는 하나가 있어요.`)
};

/**
* | output |
* | --- |
* | "One thing keeps turning up in what you write." |
*
* @param {Achievement_Shared_Neuron_3_BodyInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const achievement_shared_neuron_3_body = /** @type {((inputs?: Achievement_Shared_Neuron_3_BodyInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Achievement_Shared_Neuron_3_BodyInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_achievement_shared_neuron_3_body(inputs)
	return ko_achievement_shared_neuron_3_body(inputs)
});