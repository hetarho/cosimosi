/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Demo_Beat_Neuron_ReuseInputs */

const en_demo_beat_neuron_reuse = /** @type {(inputs: Demo_Beat_Neuron_ReuseInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Write one more entry. Where it shares something — a person, a place — it hangs from the same point, and a shape appears that nobody drew.`)
};

const ko_demo_beat_neuron_reuse = /** @type {(inputs: Demo_Beat_Neuron_ReuseInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`일기를 한 편 더 써볼까요? 겹치는 사람이나 장소가 있으면 같은 점에 매달리고, 아무도 그리지 않은 형태가 나타나요.`)
};

/**
* | output |
* | --- |
* | "Write one more entry. Where it shares something — a person, a place — it hangs from the same point, and a shape appears that nobody drew." |
*
* @param {Demo_Beat_Neuron_ReuseInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const demo_beat_neuron_reuse = /** @type {((inputs?: Demo_Beat_Neuron_ReuseInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Demo_Beat_Neuron_ReuseInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_demo_beat_neuron_reuse(inputs)
	return ko_demo_beat_neuron_reuse(inputs)
});