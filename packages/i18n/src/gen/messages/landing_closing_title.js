/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Landing_Closing_TitleInputs */

const en_landing_closing_title = /** @type {(inputs: Landing_Closing_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Try the universe, or sign in and open your own.`)
};

const ko_landing_closing_title = /** @type {(inputs: Landing_Closing_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`우주를 체험해보거나 로그인해서 내 우주를 열어보세요`)
};

/**
* | output |
* | --- |
* | "Try the universe, or sign in and open your own." |
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