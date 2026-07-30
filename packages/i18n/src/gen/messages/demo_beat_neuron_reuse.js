/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Demo_Beat_Neuron_ReuseInputs */

const en_demo_beat_neuron_reuse = /** @type {(inputs: Demo_Beat_Neuron_ReuseInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Add two more entries. Where they share something — a person, a place, an idea — they hang from the same point, and a shape appears that nobody drew.`)
};

const ko_demo_beat_neuron_reuse = /** @type {(inputs: Demo_Beat_Neuron_ReuseInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`일기 두 편을 더 넣어보세요. 사람이든 장소든 생각이든 겹치는 것이 있으면 같은 점에 매달리고, 아무도 그리지 않은 형태가 나타납니다.`)
};

/**
* | output |
* | --- |
* | "Add two more entries. Where they share something — a person, a place, an idea — they hang from the same point, and a shape appears that nobody drew." |
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