/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Achievement_Recovery_5_BodyInputs */

const en_achievement_recovery_5_body = /** @type {(inputs: Achievement_Recovery_5_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Forgetting is not losing, when you come back.`)
};

const ko_achievement_recovery_5_body = /** @type {(inputs: Achievement_Recovery_5_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`돌아온다면, 잊는 건 잃는 게 아니에요.`)
};

/**
* | output |
* | --- |
* | "Forgetting is not losing, when you come back." |
*
* @param {Achievement_Recovery_5_BodyInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const achievement_recovery_5_body = /** @type {((inputs?: Achievement_Recovery_5_BodyInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Achievement_Recovery_5_BodyInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_achievement_recovery_5_body(inputs)
	return ko_achievement_recovery_5_body(inputs)
});