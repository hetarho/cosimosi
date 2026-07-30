/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Landing_Tour_Revive_TitleInputs */

const en_landing_tour_revive_title = /** @type {(inputs: Landing_Tour_Revive_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Remembering brings one back`)
};

const ko_landing_tour_revive_title = /** @type {(inputs: Landing_Tour_Revive_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`떠올리면 돌아옵니다`)
};

/**
* | output |
* | --- |
* | "Remembering brings one back" |
*
* @param {Landing_Tour_Revive_TitleInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const landing_tour_revive_title = /** @type {((inputs?: Landing_Tour_Revive_TitleInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Landing_Tour_Revive_TitleInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_landing_tour_revive_title(inputs)
	return ko_landing_tour_revive_title(inputs)
});