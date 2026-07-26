/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Me_Nickname_InvalidInputs */

const en_me_nickname_invalid = /** @type {(inputs: Me_Nickname_InvalidInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Choose a name within the allowed length.`)
};

const ko_me_nickname_invalid = /** @type {(inputs: Me_Nickname_InvalidInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`허용된 길이 안에서 이름을 골라 주세요.`)
};

/**
* | output |
* | --- |
* | "Choose a name within the allowed length." |
*
* @param {Me_Nickname_InvalidInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const me_nickname_invalid = /** @type {((inputs?: Me_Nickname_InvalidInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Me_Nickname_InvalidInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_me_nickname_invalid(inputs)
	return ko_me_nickname_invalid(inputs)
});