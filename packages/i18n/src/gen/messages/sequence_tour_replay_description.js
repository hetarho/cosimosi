/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Sequence_Tour_Replay_DescriptionInputs */

const en_sequence_tour_replay_description = /** @type {(inputs: Sequence_Tour_Replay_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`The tour you saw when you arrived, from the beginning.`)
};

const ko_sequence_tour_replay_description = /** @type {(inputs: Sequence_Tour_Replay_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`처음 왔을 때 본 안내를, 처음부터.`)
};

/**
* | output |
* | --- |
* | "The tour you saw when you arrived, from the beginning." |
*
* @param {Sequence_Tour_Replay_DescriptionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const sequence_tour_replay_description = /** @type {((inputs?: Sequence_Tour_Replay_DescriptionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Sequence_Tour_Replay_DescriptionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_sequence_tour_replay_description(inputs)
	return ko_sequence_tour_replay_description(inputs)
});