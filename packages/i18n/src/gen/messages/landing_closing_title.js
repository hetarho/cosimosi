/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Landing_Closing_TitleInputs */

const en_landing_closing_title = /** @type {(inputs: Landing_Closing_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Look around first, and start your own if it suits you.`)
};

const ko_landing_closing_title = /** @type {(inputs: Landing_Closing_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`먼저 둘러보고, 마음에 들면 내 우주를 시작해 보세요`)
};

/**
* | output |
* | --- |
* | "Look around first, and start your own if it suits you." |
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