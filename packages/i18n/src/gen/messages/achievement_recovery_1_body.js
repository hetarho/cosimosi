/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Achievement_Recovery_1_BodyInputs */

const en_achievement_recovery_1_body = /** @type {(inputs: Achievement_Recovery_1_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`You went to something half-forgotten and found it still there.`)
};

const ko_achievement_recovery_1_body = /** @type {(inputs: Achievement_Recovery_1_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`반쯤 잊은 것에 갔더니 아직 있었어요.`)
};

/**
* | output |
* | --- |
* | "You went to something half-forgotten and found it still there." |
*
* @param {Achievement_Recovery_1_BodyInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const achievement_recovery_1_body = /** @type {((inputs?: Achievement_Recovery_1_BodyInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Achievement_Recovery_1_BodyInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_achievement_recovery_1_body(inputs)
	return ko_achievement_recovery_1_body(inputs)
});