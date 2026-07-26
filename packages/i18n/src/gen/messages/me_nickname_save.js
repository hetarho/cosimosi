/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Me_Nickname_SaveInputs */

const en_me_nickname_save = /** @type {(inputs: Me_Nickname_SaveInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Keep this name`)
};

const ko_me_nickname_save = /** @type {(inputs: Me_Nickname_SaveInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`이 이름으로 남기기`)
};

/**
* | output |
* | --- |
* | "Keep this name" |
*
* @param {Me_Nickname_SaveInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const me_nickname_save = /** @type {((inputs?: Me_Nickname_SaveInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Me_Nickname_SaveInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_me_nickname_save(inputs)
	return ko_me_nickname_save(inputs)
});