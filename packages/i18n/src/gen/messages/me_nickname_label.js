/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Me_Nickname_LabelInputs */

const en_me_nickname_label = /** @type {(inputs: Me_Nickname_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Name`)
};

const ko_me_nickname_label = /** @type {(inputs: Me_Nickname_LabelInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`이름`)
};

/**
* | output |
* | --- |
* | "Name" |
*
* @param {Me_Nickname_LabelInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const me_nickname_label = /** @type {((inputs?: Me_Nickname_LabelInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Me_Nickname_LabelInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_me_nickname_label(inputs)
	return ko_me_nickname_label(inputs)
});