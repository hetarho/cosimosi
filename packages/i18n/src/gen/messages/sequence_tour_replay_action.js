/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Sequence_Tour_Replay_ActionInputs */

const en_sequence_tour_replay_action = /** @type {(inputs: Sequence_Tour_Replay_ActionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Walk through it again`)
};

const ko_sequence_tour_replay_action = /** @type {(inputs: Sequence_Tour_Replay_ActionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`다시 둘러보기`)
};

/**
* | output |
* | --- |
* | "Walk through it again" |
*
* @param {Sequence_Tour_Replay_ActionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const sequence_tour_replay_action = /** @type {((inputs?: Sequence_Tour_Replay_ActionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Sequence_Tour_Replay_ActionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_sequence_tour_replay_action(inputs)
	return ko_sequence_tour_replay_action(inputs)
});