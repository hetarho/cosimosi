/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Landing_Closing_TitleInputs */

const en_landing_closing_title = /** @type {(inputs: Landing_Closing_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Watch it once. Then decide whether you want one.`)
};

const ko_landing_closing_title = /** @type {(inputs: Landing_Closing_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`한 번 보고 나서, 갖고 싶은지 정하세요.`)
};

/**
* | output |
* | --- |
* | "Watch it once. Then decide whether you want one." |
*
* @param {Landing_Closing_TitleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const landing_closing_title = /** @type {((inputs?: Landing_Closing_TitleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Landing_Closing_TitleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_landing_closing_title(inputs)
	return ko_landing_closing_title(inputs)
});