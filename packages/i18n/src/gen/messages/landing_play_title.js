/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Landing_Play_TitleInputs */

const en_landing_play_title = /** @type {(inputs: Landing_Play_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Try it, right here`)
};

const ko_landing_play_title = /** @type {(inputs: Landing_Play_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`여기서 한 번 띄워 보세요`)
};

/**
* | output |
* | --- |
* | "Try it, right here" |
*
* @param {Landing_Play_TitleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const landing_play_title = /** @type {((inputs?: Landing_Play_TitleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Landing_Play_TitleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_landing_play_title(inputs)
	return ko_landing_play_title(inputs)
});