/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Achievement_Recovery_20_BodyInputs */

const en_achievement_recovery_20_body = /** @type {(inputs: Achievement_Recovery_20_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`You keep returning to the faint ones. They keep answering.`)
};

const ko_achievement_recovery_20_body = /** @type {(inputs: Achievement_Recovery_20_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`희미한 것들에 계속 돌아가고, 그것들도 계속 답하네요.`)
};

/**
* | output |
* | --- |
* | "You keep returning to the faint ones. They keep answering." |
*
* @param {Achievement_Recovery_20_BodyInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const achievement_recovery_20_body = /** @type {((inputs?: Achievement_Recovery_20_BodyInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Achievement_Recovery_20_BodyInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_achievement_recovery_20_body(inputs)
	return ko_achievement_recovery_20_body(inputs)
});