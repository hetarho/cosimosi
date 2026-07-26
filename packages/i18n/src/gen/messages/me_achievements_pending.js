/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Me_Achievements_PendingInputs */

const en_me_achievements_pending = /** @type {(inputs: Me_Achievements_PendingInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`This record is not available yet.`)
};

const ko_me_achievements_pending = /** @type {(inputs: Me_Achievements_PendingInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`아직 펼쳐지지 않은 기록이에요.`)
};

/**
* | output |
* | --- |
* | "This record is not available yet." |
*
* @param {Me_Achievements_PendingInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const me_achievements_pending = /** @type {((inputs?: Me_Achievements_PendingInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Me_Achievements_PendingInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_me_achievements_pending(inputs)
	return ko_me_achievements_pending(inputs)
});