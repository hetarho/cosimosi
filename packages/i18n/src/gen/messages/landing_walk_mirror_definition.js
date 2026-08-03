/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Landing_Walk_Mirror_DefinitionInputs */

const en_landing_walk_mirror_definition = /** @type {(inputs: Landing_Walk_Mirror_DefinitionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`The sky's colour is not the average of what you felt — it is a mirror of the feelings you keep returning to.`)
};

const ko_landing_walk_mirror_definition = /** @type {(inputs: Landing_Walk_Mirror_DefinitionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`우주의 색은 내 감정의 평균이 아니라 내가 자주 떠올리는 감정의 거울이에요.`)
};

/**
* | output |
* | --- |
* | "The sky's colour is not the average of what you felt — it is a mirror of the feelings you keep returning to." |
*
* @param {Landing_Walk_Mirror_DefinitionInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const landing_walk_mirror_definition = /** @type {((inputs?: Landing_Walk_Mirror_DefinitionInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Landing_Walk_Mirror_DefinitionInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_landing_walk_mirror_definition(inputs)
	return ko_landing_walk_mirror_definition(inputs)
});