/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Landing_Theory_Card_LinkInputs */

const en_landing_theory_card_link = /** @type {(inputs: Landing_Theory_Card_LinkInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Read more`)
};

const ko_landing_theory_card_link = /** @type {(inputs: Landing_Theory_Card_LinkInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`더 알아보기`)
};

/**
* | output |
* | --- |
* | "Read more" |
*
* @param {Landing_Theory_Card_LinkInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const landing_theory_card_link = /** @type {((inputs?: Landing_Theory_Card_LinkInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Landing_Theory_Card_LinkInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_landing_theory_card_link(inputs)
	return ko_landing_theory_card_link(inputs)
});